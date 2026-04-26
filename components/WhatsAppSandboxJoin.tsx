// One-time onboarding helper that lives next to the WhatsApp number field on
// the Preferences page. Twilio's sandbox requires every recipient to send a
// "join <code>" message from their phone before the sandbox will message
// them. This card explains that and shows a QR code that, when scanned,
// opens WhatsApp with the join message pre-filled — one tap to send.
//
// When you graduate to a production WhatsApp Business sender (no join code
// needed), set NEXT_PUBLIC_WHATSAPP_SANDBOX=false in Vercel and this card
// stops rendering.

import { MessageCircle } from 'lucide-react';

const SANDBOX_NUMBER = '+14155238886';
const JOIN_CODE      = 'join ear-himself';

// wa.me click-to-chat URL with the join message pre-filled. WhatsApp on the
// recipient's phone opens the chat with the body ready to send.
const WA_LINK = `https://wa.me/${SANDBOX_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(JOIN_CODE)}`;

// Use a stable QR-as-image service. Returns a 200×200 PNG that encodes the
// click-to-chat URL above. Swappable for an inline SVG generator later if
// we want to drop the third-party dependency, but for a sandbox-onboarding
// helper this is fine.
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(WA_LINK)}`;

export function WhatsAppSandboxJoin() {
  return (
    <div className="mt-4 rounded-2xl border border-mint-200 bg-mint-50/50 p-4 flex items-start gap-4">
      {/* QR */}
      <div className="shrink-0 rounded-xl bg-white p-2 border border-slate-200 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={QR_URL}
          alt="Scan to send join code to WhatsApp sandbox"
          width={140}
          height={140}
          className="block h-[140px] w-[140px]"
        />
      </div>

      {/* Copy + manual fallback */}
      <div className="min-w-0 flex-1 space-y-2 text-sm text-ink">
        <div className="flex items-center gap-2 text-mint-700 font-bold">
          <MessageCircle className="h-4 w-4" />
          One-time WhatsApp setup
        </div>
        <p className="text-ink leading-snug">
          Before the first reminder can reach you, send this exact message from
          your WhatsApp to our number — it activates delivery on your phone.
        </p>
        <div className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Send to</div>
          <div className="font-mono font-semibold text-ink-strong">{SANDBOX_NUMBER}</div>
          <div className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold mt-2">Message</div>
          <div className="font-mono font-semibold text-ink-strong">{JOIN_CODE}</div>
        </div>
        <a
          href={WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-mint-500 hover:bg-mint-600 text-white text-xs font-semibold px-3 py-1.5"
        >
          Open WhatsApp with message ready
        </a>
        <p className="text-[11px] text-ink-muted leading-snug">
          Or scan the QR with your phone — WhatsApp opens with the join
          message pre-filled, just tap send. You only do this once.
        </p>
      </div>
    </div>
  );
}
