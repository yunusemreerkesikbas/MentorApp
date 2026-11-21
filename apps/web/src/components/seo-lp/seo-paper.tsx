import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { PAGE_FRAME, PAPER_PILL } from "@/app/[locale]/_components/landing/landing-paper";
import { Link } from "@/i18n/navigation";

/*
 * The paper kit the six SEO pages share ("Landing'in odası", spec
 * docs/superpowers/specs/2026-11-21-seo-lp-landing-rooms-design.md): the hero with its scene, taped
 * notes, post-it steps, a notebook-page table, luggage-tag links and the Caveat scribble. Styles
 * are in `seo-paper.css`, scoped under `.seo-lp` (SeoLpShell's `<main>`). Server components only;
 * the breeze on the notes comes from SeoFlutterRoot around them.
 */

type Href = ComponentProps<typeof Link>["href"];

/** Custom properties set per note; React types `style` without them. */
type PaperStyle = CSSProperties & Record<`--${string}`, string | number>;

const POSTIT_COLORS = ["#fff1a6", "#ffd9cf", "#d6ecff", "#dff3d8"] as const;
const POSTIT_TILTS = ["-1.4deg", "1deg", "-0.6deg", "1.3deg"] as const;

/** The hand-drawn arrow after a scribble, from the canvas kit. */
function ScribbleArrow() {
  return (
    <svg viewBox="0 0 58 40" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6c14 2 30 9 42 26" />
      <path d="M33 30l12 3 1-12" />
    </svg>
  );
}

/** The green hand-drawn tick that marks PuhuKoç's column in a notebook table. */
function HandTick() {
  return (
    <svg className="seo-tick" viewBox="0 0 22 18" fill="none" stroke="#1a8a4a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9.5l6 6L20 2.5" />
    </svg>
  );
}

export function HandScribble({ children }: { children: ReactNode }) {
  return (
    <p className="seo-scribble">
      <span>{children}</span>
      <ScribbleArrow />
    </p>
  );
}

/**
 * Desktop: copy on the left, the scene on the right. Phone: the scene follows the copy. `pinned`
 * is the live note tucked under the scene's bottom edge; it stays in flow, so a tall note pushes
 * the page down instead of spilling over it.
 */
export function SeoHero({
  pill,
  h1,
  lead,
  proof,
  ctas,
  scribble,
  scene,
  pinned,
}: {
  pill: string;
  h1: string;
  lead: ReactNode;
  proof: ReactNode;
  ctas: ReactNode;
  scribble: ReactNode;
  scene: ReactNode;
  pinned?: ReactNode;
}) {
  return (
    <section className={`${PAGE_FRAME} seo-hero`}>
      <div className="seo-hero-copy">
        <p className={`${PAPER_PILL} bg-[var(--landing-pill)] text-[var(--landing-pill-ink)]`}>{pill}</p>
        <h1 className="seo-h1">{h1}</h1>
        <p className="seo-lead">{lead}</p>
        <p className="seo-proof">{proof}</p>
        <div className="seo-ctas">{ctas}</div>
        <HandScribble>{scribble}</HandScribble>
      </div>
      <div className="seo-hero-scene">
        {scene}
        {pinned ? <div className="seo-hero-pinned">{pinned}</div> : null}
      </div>
    </section>
  );
}

/**
 * The scene's rounded frame with a paper ring. With `label` the frame is one picture for assistive
 * tech (`role="img"`); leave it out when the scene holds controls, or they would be hidden.
 */
export function SceneFrame({ className, label, children }: { className?: string; label?: string; children: ReactNode }) {
  return (
    <div
      className={className ? `seo-scene ${className}` : "seo-scene"}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      {children}
    </div>
  );
}

/**
 * A taped paper note: plain, lined or grid paper, a tape colour and a tilt. `pin` holds it with a
 * red pin instead of tape. `name` is the Caveat label on top (`plate` adds the enamel door plate beside it); `heading` sets the title's level
 * where the note itself is a section (the default `h3` sits under a section's `h2`).
 */
export function PaperNote({
  name,
  plate,
  title,
  paper,
  tape = "#9cc7f0",
  tilt = "-0.6deg",
  pin = false,
  heading: Heading = "h3",
  children,
}: {
  name?: string;
  plate?: string;
  title?: string;
  paper?: "lined" | "grid";
  tape?: string;
  tilt?: string;
  pin?: boolean;
  heading?: "h2" | "h3";
  children: ReactNode;
}) {
  const style: PaperStyle = { "--tilt": tilt, "--tape": tape };
  return (
    <article data-flutter="" className={paper ? `seo-note is-${paper}` : "seo-note"} style={style}>
      {pin ? <i className="seo-pin" aria-hidden="true" /> : <i className="seo-tape" aria-hidden="true" />}
      {name ? (
        <p className="seo-note-name">
          {name}
          {plate ? <span className="seo-plate">{plate}</span> : null}
        </p>
      ) : null}
      {title ? <Heading className="seo-note-title">{title}</Heading> : null}
      <div className="seo-note-body">{children}</div>
    </article>
  );
}

/** Numbered steps on post-its: Caveat numbers, colours and tilts cycling through the kit's four. */
export function PostitSteps({ steps }: { steps: { title?: string; body: string }[] }) {
  return (
    <ol className="seo-postits" style={{ "--n": steps.length } as PaperStyle}>
      {steps.map((step, i) => (
        <li
          key={step.title ?? step.body}
          className="seo-postit"
          style={{ "--pc": POSTIT_COLORS[i % POSTIT_COLORS.length], "--tilt": POSTIT_TILTS[i % POSTIT_TILTS.length] } as PaperStyle}
        >
          <span className="seo-postit-num">{i + 1}</span>
          {step.title ? <h3>{step.title}</h3> : null}
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * A table written on a notebook page: red margin, punched holes, blue lines. Pass `label` to name it; `handFirst` writes the first column in Caveat (days). It scrolls sideways
 * inside its own box on a phone. `markLast` ticks the last cell of every row (PuhuKoç's column).
 */
export function NotebookTable({
  head,
  rows,
  markLast = false,
  handFirst = false,
  label,
}: {
  head: string[];
  rows: string[][];
  markLast?: boolean;
  handFirst?: boolean;
  label?: string;
}) {
  // The box scrolls, so a keyboard user must be able to reach it, and it needs a name.
  return (
    <div className="seo-notebook" tabIndex={0} role="region" aria-label={label}>
      <table>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => {
                const last = markLast && i === row.length - 1;
                const className = last ? "is-ours" : handFirst && i === 0 ? "is-day" : undefined;
                return (
                  <td key={i} className={className}>
                    {last ? <HandTick /> : null}
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Internal links as luggage tags. */
export function TagLinks({ links }: { links: { href: Href; label: string }[] }) {
  return (
    <ul className="seo-tags">
      {links.map((link) => (
        <li key={link.label}>
          <Link href={link.href} className="seo-tag">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
