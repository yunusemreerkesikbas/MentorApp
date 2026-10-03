"use client";

import { COVER_MATERIALS } from "@/components/notebook/notebook-surface";
import { DESK_TILT_DEG } from "@/lib/notebook-desk";
import { deskBookTransform } from "./desk-notebook";

/**
 * A new notebook still in its wrapping, tied with twine, sitting at the end of the desk.
 *
 * A shortcut for the pointer only, and hidden from assistive tech on purpose: the header's
 * "Yeni defter" button is the control, and a second control with the same job and the same name
 * would make the desk say everything twice.
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
          className="desk-package cursor-pointer"
          aria-hidden="true"
          onClick={onOpen}
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
                    <span className="nb-package-tag">{label}</span>
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
