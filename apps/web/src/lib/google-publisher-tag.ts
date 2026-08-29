import type { AdAudienceTreatment } from "@mentor/types";

type GptSlot = object;
type GptEvent = { slot: GptSlot; isEmpty?: boolean; makeRewardedVisible?: () => void };
type GptService = {
  addEventListener: (name: string, listener: (event: GptEvent) => void) => void;
  removeEventListener: (name: string, listener: (event: GptEvent) => void) => void;
  collapseEmptyDivs: () => void;
  setPrivacySettings: (settings: Record<string, boolean | null>) => void;
};
type GoogleTag = {
  cmd: Array<() => void>;
  enums: { OutOfPageFormat: { REWARDED: string } };
  defineSlot: (path: string, sizes: ReadonlyArray<readonly [number, number]>, id: string) => { addService: (service: GptService) => GptSlot } | null;
  defineOutOfPageSlot: (path: string, format: string) => { addService: (service: GptService) => GptSlot } | null;
  pubads: () => GptService;
  enableServices: () => void;
  display: (idOrSlot: string | GptSlot) => void;
  destroySlots: (slots: GptSlot[]) => boolean;
};

declare global { interface Window { googletag?: GoogleTag } }

const LIMITED_GPT_URL = "https://pagead2.googlesyndication.com/tag/js/gpt.js";
let loader: Promise<GoogleTag> | null = null;

/** The limited-ads build is the only GPT script Mentor loads. */
export function loadLimitedGpt(): Promise<GoogleTag> {
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    window.googletag ??= { cmd: [] } as unknown as GoogleTag;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LIMITED_GPT_URL}"]`);
    if (existing?.dataset.loaded === "true") return resolve(window.googletag!);
    const script = existing ?? document.createElement("script");
    script.async = true;
    script.src = LIMITED_GPT_URL;
    script.crossOrigin = "anonymous";
    script.onload = () => { script.dataset.loaded = "true"; resolve(window.googletag!); };
    script.onerror = () => { loader = null; reject(new Error("GPT failed to load")); };
    if (!existing) document.head.appendChild(script);
  });
  return loader;
}

export async function withGpt<T>(run: (gpt: GoogleTag) => T): Promise<T> {
  const gpt = await loadLimitedGpt();
  return new Promise<T>((resolve, reject) => gpt.cmd.push(() => {
    try { resolve(run(gpt)); } catch (error) { reject(error); }
  }));
}

export function configureLimitedPrivacy(gpt: GoogleTag, treatment: AdAudienceTreatment): void {
  gpt.pubads().setPrivacySettings({
    limitedAds: true,
    childDirectedTreatment: treatment === "CHILD" ? true : null,
    underAgeOfConsent: treatment === "TEEN" ? true : null,
  });
}

export type { GptEvent, GptService, GptSlot, GoogleTag };
