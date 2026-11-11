// The kit pieces as plain data (15 launch + 6 Premium + the T1 promo film). Root.tsx maps them to components.
export type PieceId =
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6"
  | "S1" | "S2" | "S3" | "S4"
  | "R1" | "R2" | "R3"
  | "X1" | "L1"
  | "PF1" | "PF2" | "PS1" | "PS2" | "PR1" | "PR2"
  | "T1"
  | "IF1" | "IF2" | "IF3" | "IF4" | "IF5" | "IF6"
  | "IS1" | "IS2" | "IS3" | "IS4" | "IS5" | "IS6"
  | "IR1";

export type Format = "feed" | "story" | "reel" | "landscape";

export const SIZES: Record<Format, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  reel: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 675 },
};

export type Video = { fps: 30; durationInFrames: number; endCardFrom: number; coverFrame: number };

export type Piece = { id: PieceId; format: Format; title: string; cards?: number; video?: Video };

// One beat = 0.5 s at 30 fps; cuts land on this grid.
export const BEAT = 15;

export const PIECES: Piece[] = [
  { id: "F1", format: "feed", title: "Yalnız çalışmak yasak" },
  { id: "F2", format: "feed", title: "Sınava çalışmak zor" },
  { id: "F3", format: "feed", title: "Yerini şimdiden ayıralım" },
  { id: "F4", format: "feed", title: "Puhu'yla bir gün", cards: 5 },
  { id: "F5", format: "feed", title: "Hangi sınava hazırlanıyorsun" },
  { id: "F6", format: "feed", title: "Tek başına ben, masada ben" },
  { id: "S1", format: "story", title: "POV: son bir video" },
  { id: "S2", format: "story", title: "Gece çalışan tek kişi sen değilsin" },
  { id: "S3", format: "story", title: "Bugünün listesi" },
  { id: "S4", format: "story", title: "Hangi çalışma tipisin" },
  { id: "R1", format: "reel", title: "POV reel", video: { fps: 30, durationInFrames: 300, endCardFrom: 180, coverFrame: 120 } },
  { id: "R2", format: "reel", title: "Masa doluyor", video: { fps: 30, durationInFrames: 360, endCardFrom: 270, coverFrame: 210 } },
  { id: "R3", format: "reel", title: "Rozet ritmi", video: { fps: 30, durationInFrames: 270, endCardFrom: 195, coverFrame: 120 } },
  { id: "X1", format: "landscape", title: "X kartı" },
  { id: "L1", format: "landscape", title: "LinkedIn kartı" },
  // Premium (2026-11-08): 1 = Kahraman modu (cream), 2 = Gece uçuşu (night).
  { id: "PF1", format: "feed", title: "Premium · Kahraman modu" },
  { id: "PF2", format: "feed", title: "Premium · Puhu'ya pelerin geldi" },
  { id: "PS1", format: "story", title: "Premium · Kahraman modu" },
  { id: "PS2", format: "story", title: "Premium · Puhu'ya pelerin geldi" },
  { id: "PR1", format: "reel", title: "Premium · Kahraman modu", video: { fps: 30, durationInFrames: 270, endCardFrom: 210, coverFrame: 180 } },
  { id: "PR2", format: "reel", title: "Premium · Gece uçuşu", video: { fps: 30, durationInFrames: 270, endCardFrom: 210, coverFrame: 180 } },
  // Promo film (spec docs/plans/2026-11-08-promo-video-design.md): 62 s = 31 bars at 120 BPM.
  { id: "T1", format: "reel", title: "Tanıtım · Ekrana dalış", video: { fps: 30, durationInFrames: 1860, endCardFrom: 1800, coverFrame: 475 } },
  // Feature ads, wave 1 (spec docs/plans/2026-11-10-feature-ads-design.md). The number is the feature:
  // 1 odak seansı, 2 haftalık plan, 3 Yanlış Defterim, 4 deneme analizi, 5 masa, 6 haftalık lakap. IF = "Puhu iş başında" feed,
  // IS = POV story, IR = 8 s reel (16 beats).
  { id: "IF1", format: "feed", title: "İş başında · Koruma (odak seansı)" },
  { id: "IF2", format: "feed", title: "İş başında · Navigasyon (haftalık plan)" },
  { id: "IF3", format: "feed", title: "İş başında · Dedektif (Yanlış Defterim)" },
  { id: "IF4", format: "feed", title: "İş başında · Hava durumu spikeri (deneme analizi)" },
  { id: "IF5", format: "feed", title: "İş başında · Hakem (masa)" },
  { id: "IF6", format: "feed", title: "İş başında · Sunucu (haftalık lakap)" },
  { id: "IS1", format: "story", title: "POV · bir bildirime bakıp çıkacağım" },
  { id: "IS2", format: "story", title: "POV · pazartesi başlıyorum" },
  { id: "IS3", format: "story", title: "POV · bu soruya sonra bakarım" },
  { id: "IS4", format: "story", title: "POV · hangi konudan başlasam" },
  { id: "IS5", format: "story", title: "POV · kütüphaneye gidince çalışırım" },
  { id: "IS6", format: "story", title: "POV · bu hafta hiçbir şey yapmadım" },
  { id: "IR1", format: "reel", title: "İş başında · Koruma reel", video: { fps: 30, durationInFrames: 240, endCardFrom: 180, coverFrame: 150 } },
];

export const compositionIds = (p: Piece): string[] =>
  p.cards ? Array.from({ length: p.cards }, (_, i) => `${p.id}-${i + 1}`) : [p.id];

export type GuideProps = { guides: boolean; safe: boolean };

// Exports never show the dashed sticker guides or the safe-zone overlay.
export const EXPORT_PROPS: GuideProps = { guides: false, safe: false };
export const STUDIO_PROPS: GuideProps = { guides: true, safe: false };

// What every piece component receives. F4 cards also get `card` (1-based).
export type PieceProps = GuideProps & { card?: number };

// Sticker guides are a Studio preview aid; a render never shows them.
export const guideVisible = (guides: boolean, rendering: boolean): boolean => guides && !rendering;
