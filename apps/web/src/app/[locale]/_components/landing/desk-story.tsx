import { at } from "./desk-room";
import { SceneImg, sceneBackground } from "./scene-img";

/**
 * "Haftanın hikâyesi" as the app plays it: its own lines (`analysis.recap.*`), its coral, lavender
 * and mint, its chrome-and-flower art and a weekly codename character. The phone on the desk cycles
 * four screens; the note fans three out. The numbers are a sample week.
 */

export interface StoryCopy {
  welcome: string;
  dates: string;
  focusTitle: string;
  focusMinutes: string;
  runTitle: string;
  codenameLabel: string;
  codename: string;
}

const NEBULA = "/visuals/landing/desk-recap-nebula.webp";

function Decor({ src, className }: { src: string; className: string }) {
  return <SceneImg src={`/visuals/landing/desk-recap-${src}.webp`} loading="lazy" className={className} />;
}

/** Pause, sound and close, as the story's top bar draws them. */
const CONTROLS = (
  <svg className="ld-controls" viewBox="0 0 37 12">
    <g fill="#000" opacity=".28">
      <circle cx="5.6" cy="6" r="5.6" />
      <circle cx="18.6" cy="6" r="5.6" />
      <circle cx="31.6" cy="6" r="5.6" />
    </g>
    <g fill="#fff">
      <rect x="3.6" y="3.5" width="1.3" height="5" />
      <rect x="6.3" y="3.5" width="1.3" height="5" />
      <path d="M16.2 4.6h1.6l2.2-1.8v6.4l-2.2-1.8h-1.6z" />
    </g>
    <path d="M29.6 4l4 4m0-4-4 4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

export function StoryPhone({ copy }: { copy: StoryCopy }) {
  return (
    <div className="ld-at ld-phone" style={at(692, 226, 134, 258)}>
      <i className="ld-phone-key is-1" />
      <i className="ld-phone-key is-2" />
      <i className="ld-phone-key is-3" />
      <div className="ld-phone-body">
        <div className="ld-screen">
          <div className="ld-slide is-welcome s1">
            <b>{copy.welcome}</b>
            <small>{copy.dates}</small>
          </div>
          <div className="ld-slide is-focus s2">
            <b>{copy.focusTitle}</b>
            <strong>265</strong>
            <small>{copy.focusMinutes}</small>
            <Decor src="world" className="ld-globe" />
            <Decor src="floral" className="ld-decor is-floral" />
            <Decor src="wiggle" className="ld-decor is-wiggle" />
          </div>
          <div className="ld-slide is-run s3">
            <Decor src="floral" className="ld-decor is-floral-top" />
            <strong>4</strong>
            <b>{copy.runTitle}</b>
            <Decor src="wiggle" className="ld-decor is-wiggle-low" />
          </div>
          <div className="ld-slide is-code s4" style={sceneBackground(NEBULA)}>
            <small>{copy.codenameLabel}</small>
            <b>{copy.codename}</b>
          </div>
          <span className="ld-bars">
            {[1, 2, 3, 4].map((n) => (
              <i key={n} className={`ld-bar b${n}`}>
                <b />
              </i>
            ))}
          </span>
          {CONTROLS}
          <span className="ld-glare" />
        </div>
        <span className="ld-island" />
      </div>
      <span className="ld-stand" />
    </div>
  );
}

function Bars({ on }: { on: number }) {
  return (
    <span className="ld-fan-bars">
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= on ? "is-on" : undefined} />
      ))}
    </span>
  );
}

export function StoryFan({ copy }: { copy: StoryCopy }) {
  return (
    <div className="ld-mini ld-fan" aria-hidden="true">
      <div className="ld-fan-card is-run">
        <Bars on={2} />
        <strong>4</strong>
        <small>{copy.runTitle}</small>
      </div>
      <div className="ld-fan-card is-focus">
        <Bars on={1} />
        <small>{copy.focusTitle}</small>
        <strong>265</strong>
        <small>{copy.focusMinutes}</small>
        <Decor src="world" className="ld-fan-globe" />
      </div>
      <div className="ld-fan-card is-code" style={sceneBackground(NEBULA)}>
        <Bars on={3} />
        <em>{copy.codenameLabel}</em>
        <span>{copy.codename}</span>
      </div>
    </div>
  );
}
