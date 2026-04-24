/**
 * Thin decorative wave divider. Place between sections to keep the page from
 * feeling like a stack of cards in a grey box.
 */
export function SectionWave({ tint = '#E8EEF7' }: { tint?: string }) {
  return (
    <svg className="w-full h-8 my-2" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0,20 C200,40 400,0 600,20 C800,40 1000,0 1200,20 L1200,40 L0,40 Z"
        fill={tint}
        opacity="0.5"
      />
    </svg>
  );
}
