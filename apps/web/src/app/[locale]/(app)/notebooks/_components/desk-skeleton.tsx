import { DESK_TILT_DEG } from "@/lib/notebook-desk";
import { deskBookTransform } from "./desk-notebook";

/** Resting spins for the placeholders, so the loading desk already looks put down by hand. */
const SPINS = [-3.2, 2.4, -1.6, 3.6, -2.6, 1.8, -3.8, 2.9];

/**
 * The notebooks' places on the desk while the list loads: book-shaped, in the books' own pose and
 * proportions, so the real ones settle into exactly the spots the placeholders held. The room
 * around them is already real; only the books are pending.
 */
export function DeskSkeletonBooks() {
  return (
    <>
      {SPINS.map((spin, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="desk-cell relative flex justify-center"
        >
          <div className="desk-book-slot">
            <div className="nb-book">
              <div
                className="nb-book-3d"
                style={{ transform: deskBookTransform(DESK_TILT_DEG, spin) }}
              >
                <div className="mentor-skeleton-shimmer desk-skeleton-book" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
