/**
 * The scene's moving DOM parts, collected once by their `data-scene` / `data-part` markers.
 * React renders the structure; the frame painter only writes transforms and opacities to these
 * nodes, so a frame never re-renders React.
 */

export interface BadgeDom {
  root: HTMLElement;
  /** 2D transform: position, squash, tilt, flight stretch. */
  tf: HTMLElement;
  /** The 3D flip. */
  rot: HTMLElement;
  faces: HTMLElement[];
  sheens: HTMLElement[];
  glints: HTMLElement[];
  edge: HTMLElement;
  /** Glow wrapper around Puhu's mark on the card back. */
  mark: HTMLElement;
}

export interface SceneDom {
  root: HTMLElement;
  duskSheet: HTMLElement;
  duskGlow: HTMLElement;
  cam: HTMLElement;
  halo: HTMLElement;
  flash: HTMLElement;
  eyebrow: HTMLElement;
  words: HTMLElement[];
  body: HTMLElement;
  ledge: HTMLElement;
  more: HTMLElement | null;
  badges: BadgeDom[];
  labels: HTMLElement[];
  stars: HTMLCanvasElement;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

function one<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function all<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function badge(root: HTMLElement): BadgeDom | null {
  const tf = one<HTMLElement>(root, '[data-part="tf"]');
  const rot = one<HTMLElement>(root, '[data-part="rot"]');
  const edge = one<HTMLElement>(root, '[data-part="edge"]');
  const mark = one<HTMLElement>(root, '[data-part="mark"]');
  if (!tf || !rot || !edge || !mark) return null;
  return {
    root,
    tf,
    rot,
    edge,
    mark,
    faces: all(root, '[data-part="face"]'),
    sheens: all(root, '[data-part="sheen"]'),
    glints: all(root, '[data-part="glint"]'),
  };
}

/** `null` until every part the painter needs is mounted. */
export function collectSceneDom(root: HTMLElement): SceneDom | null {
  const get = <T extends Element>(name: string) => one<T>(root, `[data-scene="${name}"]`);
  const duskSheet = get<HTMLElement>("dusk-sheet");
  const duskGlow = get<HTMLElement>("dusk-glow");
  const cam = get<HTMLElement>("cam");
  const halo = get<HTMLElement>("halo");
  const flash = get<HTMLElement>("flash");
  const eyebrow = get<HTMLElement>("eyebrow");
  const body = get<HTMLElement>("body");
  const ledge = get<HTMLElement>("ledge");
  const stars = get<HTMLCanvasElement>("stars");
  const back = get<HTMLCanvasElement>("fx-back");
  const front = get<HTMLCanvasElement>("fx-front");
  const badges = all<HTMLElement>(root, '[data-scene="badge"]').map(badge);
  if (
    !duskSheet || !duskGlow || !cam || !halo || !flash || !eyebrow || !body || !ledge ||
    !stars || !back || !front || badges.some((b) => b === null)
  ) {
    return null;
  }
  return {
    root,
    duskSheet,
    duskGlow,
    cam,
    halo,
    flash,
    eyebrow,
    words: all(root, '[data-scene="word"]'),
    body,
    ledge,
    more: get<HTMLElement>("more"),
    badges: badges as BadgeDom[],
    labels: all(root, '[data-scene="badge-label"]'),
    stars,
    back,
    front,
  };
}
