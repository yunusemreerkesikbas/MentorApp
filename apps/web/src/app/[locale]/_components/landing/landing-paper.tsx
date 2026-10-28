import { jsonLdHtml } from "@/lib/json-ld";

/**
 * The paper sections shared by the landing (after the dawn) and the coach page: the page frame, the
 * pill, the section heading, the outline ledge on paper, and the FAQ. They need `.landing-paper`
 * (theme.css) on an ancestor for their colours.
 */
export const PAGE_FRAME = "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10";
export const PAPER_PILL = "inline-flex min-h-8 items-center rounded-full px-3 text-caption font-extrabold";
export const PAPER_TITLE = "mt-3 text-display font-black tracking-[-0.01em] lg:text-section";
export const LEDGE_ON_PAPER = "border-2 border-[var(--landing-paper-line)] text-[var(--landing-ink)]";

export interface FaqItem {
  q: string;
  a: string;
}

/** Native `<details>`, plus the same questions as FAQPage JSON-LD for search. Anchored at `#sss`. */
export function PaperFaq({ pill, title, items, nonce }: { pill: string; title: string; items: FaqItem[]; nonce?: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <section id="sss" aria-labelledby="paper-faq-title" className={`${PAGE_FRAME} scroll-mt-24 pt-16 lg:pt-24`}>
      <div className="max-w-4xl">
        <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{pill}</p>
        <h2 id="paper-faq-title" className={PAPER_TITLE}>
          {title}
        </h2>
        <div className="mt-4 border-b border-[var(--landing-paper-line)]">
          {items.map(({ q, a }) => (
            <details key={q} className="group border-t border-[var(--landing-paper-line)]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] lg:text-lg [&::-webkit-details-marker]:hidden">
                <span>{q}</span>
                <b
                  aria-hidden="true"
                  className="flex size-8 flex-none items-center justify-center rounded-full bg-[var(--landing-pill)] text-xl transition-transform group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </b>
              </summary>
              <p className="pb-5 text-base leading-relaxed text-[var(--landing-ink-soft)] lg:pr-12">{a}</p>
            </details>
          ))}
        </div>
      </div>
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
    </section>
  );
}
