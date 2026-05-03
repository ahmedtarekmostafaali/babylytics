import type { Config } from 'tailwindcss';

const config: Config = {
  // 050 batch: opt into class-based dark mode. The boot script in
  // app/layout.tsx toggles `.dark` on <html> based on the user's pref.
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Soft Blue (brand anchor, primary actions)
        brand: {
          50:  '#F2F7FC',
          100: '#E2EDF7',
          200: '#C2D9EE',
          300: '#A0C2E3',
          400: '#8EB8DE',
          500: '#7BAEDC',  // soft blue
          600: '#5690C8',
          700: '#3E74A8',
          800: '#2D5985',
          900: '#1F3E5E',
        },
        // Secondary — Mint (positive states, health/growth)
        mint: {
          50:  '#F0F9F4',
          100: '#DEF1E6',
          300: '#A8DCC0',
          500: '#7FC8A9',
          600: '#5FAE8A',
          700: '#458E6F',
        },
        // Secondary — Coral / Baby pink (alerts, emotional highlights)
        coral: {
          50:  '#FCF2F2',
          100: '#F9E1E1',
          300: '#F4A6A6',
          500: '#F4A6A6',  // stays soft at mid tone
          600: '#E07878',
          700: '#C05858',
        },
        // Secondary — Lavender (sleep, calm)
        lavender: {
          50:  '#F5F2FA',
          100: '#ECE6F4',
          300: '#D0C2E6',
          500: '#B9A7D8',
          600: '#9A85C1',
          700: '#7B66A3',
        },
        // Secondary — Peach / Soft Orange (feeding, activity)
        peach: {
          50:  '#FDF7EC',
          100: '#FBEBCE',
          300: '#F6C177',
          500: '#F6C177',
          600: '#E2A444',
          700: '#B88129',
        },
        // Neutrals
        beige:  '#F2D1B3',
        canvas: '#F7F7F7',
        ink: {
          DEFAULT: '#555555',
          strong:  '#333333',
          muted:   '#8A8A8A',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        panel: '0 4px 12px rgba(15,23,42,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
