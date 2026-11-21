"use client";

import "./seo-facade.css";
import { type ComponentProps, type CSSProperties, type ReactNode, useState } from "react";
import { SceneImg } from "@/app/[locale]/_components/landing/scene-img";
import type { Link } from "@/i18n/navigation";
import { PaperNote, SceneFrame, TagLinks } from "./seo-paper";

type Href = ComponentProps<typeof Link>["href"];

export interface FacadeItem {
  id: "puhu" | "defter" | "plan" | "odak" | "masa";
  /** The paper tag on the window. */
  tag: string;
  /** The note's Caveat name. */
  name: string;
  title: string;
  body: string;
  /** Formatted on the server ("NO 4"). */
  plate: string;
  /** Percent of the facade box. */
  x: string;
  y: string;
  tilt: string;
  link?: { href: Href; label: string };
}

type TagStyle = CSSProperties & Record<`--${string}`, string>;

const DEFAULT_ID: FacadeItem["id"] = "plan";

/**
 * The study app hero: the dawn scene (sky and far city come in as `children`, server-rendered), the
 * facade with a paper tag on each window and, under the scene, the pinned note of the chosen
 * feature. Tags are toggle buttons; the note is a polite live region. Without JS the opening
 * choice (Plan) is still in the HTML. `facadeAlt` names the facade picture for assistive tech.
 */
export function FacadeTags({ items, facadeAlt, children }: { items: FacadeItem[]; facadeAlt: string; children: ReactNode }) {
  const [selected, setSelected] = useState<FacadeItem["id"]>(DEFAULT_ID);
  const current = items.find((item) => item.id === selected) ?? items[0];

  return (
    <>
      <SceneFrame className="seo-dawn">
        {children}
        <div className="seo-facade">
          <SceneImg src="/visuals/landing/city-facade.webp" alt={facadeAlt} width={1024} height={1536} loading="eager" fetchPriority="high" />
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="seo-wtag"
              aria-pressed={item.id === selected}
              style={{ left: item.x, top: item.y, "--r": item.tilt } as TagStyle}
              onClick={() => setSelected(item.id)}
            >
              <span>{item.tag}</span>
            </button>
          ))}
        </div>
      </SceneFrame>
      <div className="seo-hero-pinned" aria-live="polite">
        <PaperNote name={current.name} plate={current.plate} title={current.title} heading="h2" paper="grid" tape="#ffd15c" tilt="1.4deg">
          <p>{current.body}</p>
          {current.link ? <TagLinks links={[current.link]} /> : null}
        </PaperNote>
      </div>
    </>
  );
}
