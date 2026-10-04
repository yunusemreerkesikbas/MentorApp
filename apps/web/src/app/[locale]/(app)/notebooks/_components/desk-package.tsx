"use client";

import { COVER_MATERIALS } from "@/components/notebook/notebook-surface";
import { DESK_TILT_DEG } from "@/lib/notebook-desk";
import { deskBookTransform } from "./desk-notebook";

/**
 * A new notebook still in its wrapping, tied with twine, sitting at the end of the desk.
 *
 * The page's one "Yeni defter" control: a real button, so a keyboard reaches it and a screen
 * reader names it by the tag it carries. A `div` with a button role rather than a `<button>`,
 * because what it holds is a stack of 3D faces, not phrasing content. Focus lifts it the same way the pointer does.
 */
export function DeskPackage({
  label,
  lifted,
  onActive,
  onOpen,
}: {
  label: string;
  lifted: boolean;
  onActive: (active: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="desk-cell relative flex justify-center"
      onPointerEnter={() => onActive(true)}
      onPointerLeave={() => onActive(false)}
    >
      <div className="desk-book-slot relative">
        <div
          role="button"
          tabIndex={0}
          className="desk-package desk-book-link block cursor-pointer outline-none"
          aria-label={label}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          onFocus={() => onActive(true)}
          onBlur={() => onActive(false)}
        >
          <div className="nb-book" data-lifted={lifted} style={{ ["--nb-th" as string]: "3.4cqw" }}>
            <div
              className="nb-book-3d"
              style={{
                transform: deskBookTransform(
                  lifted ? DESK_TILT_DEG - 4 : DESK_TILT_DEG,
                  lifted ? 3.6 : 6,
                ),
              }}
            >
              <div className="nb-book-shadow" data-layer="ambient" />
              <div className="nb-book-shadow" data-layer="contact" />
              <div className="nb-book-lift">
                <div className="nb-book-back" style={{ background: "#6e5232" }} />
                <div
                  className="nb-book-edge-bottom"
                  style={{
                    background:
                      "linear-gradient(180deg, #6e5232 0 0.6cqw, #b88a58 0.6cqw, #9f7547 100%)",
                  }}
                />
                <div
                  className="nb-book-edge-right"
                  style={{
                    background:
                      "linear-gradient(90deg, #6e5232 0 0.6cqw, #b88a58 0.6cqw, #9f7547 100%)",
                  }}
                />
                <div className="nb-book-cover" style={{ transform: "translateZ(var(--nb-th))" }}>
                  <div
                    className="nb-book-face nb-package-face"
                    style={{
                      backgroundColor: "#b88a58",
                      backgroundImage: COVER_MATERIALS.kraft,
                    }}
                  >
                    <span className="nb-package-twine" data-axis="v" />
                    <span className="nb-package-twine" data-axis="h" />
                    <span className="nb-package-bow" />
                    <span className="nb-package-tag" aria-hidden="true">
                      {label}
                    </span>
                    <div className="nb-book-sheen" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
