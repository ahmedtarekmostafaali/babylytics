/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase storage public-signed URLs use the project host; tighten in prod.
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' }, // for file uploads
  },

  // Security headers applied to every route. Narrow CSP just enough to still
  // allow our client bundle, inline styles (Next required), the Supabase
  // backend, and our image CDN.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 2 years; allow subdomains; eligible for HSTS preload.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Don't let other sites frame the app (clickjacking defence).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Old browsers — block MIME sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Don't leak the URL as a Referer to third-party domains.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable powerful browser features we don't use.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Tight-ish CSP: allow our own origin, Supabase, blob: (for exports).
          // Note: Next requires 'unsafe-inline' for its client bootstrap; we
          // mitigate the common XSS vectors by escaping all user content via
          // React (no dangerouslySetInnerHTML on user-generated strings).
          { key: 'Content-Security-Policy', value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; ') },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
