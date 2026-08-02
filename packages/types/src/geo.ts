/**
 * Geo reference contracts — Turkish provinces + universities, used by the goal map ("hedef
 * haritası") on the panel. Pure reference data: which universities exist in which province.
 *
 * Deliberately NOT here (roadmap §1 "B layer"): programs/departments, base scores, quotas,
 * placement simulation. Those carry annual-maintenance and accuracy liability that the product
 * decided against. This payload only ever states facts that a single editorial source verified.
 */

/** The seven geographic regions — used to group the accessible province list, not a political unit. */
export const GEO_REGIONS = [
  "MARMARA",
  "EGE",
  "AKDENIZ",
  "IC_ANADOLU",
  "KARADENIZ",
  "DOGU_ANADOLU",
  "GUNEYDOGU_ANADOLU",
] as const;
export type GeoRegion = (typeof GEO_REGIONS)[number];

export const UNIVERSITY_KINDS = [
  "STATE",
  "FOUNDATION",
  "FOUNDATION_VOCATIONAL",
] as const;
export type UniversityKind = (typeof UNIVERSITY_KINDS)[number];

export interface UniversityDto {
  id: string;
  name: string;
  slug: string;
  kind: UniversityKind;
  /** Null when the source didn't state it — never guessed. */
  foundedYear: number | null;
  websiteUrl: string | null;
  /**
   * Main-campus coordinates. Null when geocoding could not confirm a position inside the province
   * the guide lists — such a university still appears in the city's list, it just gets no map pin.
   * A missing pin is a gap; a pin in the wrong city is a lie.
   */
  latitude: number | null;
  longitude: number | null;
  /** Programs on offer, so the map card can say something without a second request. */
  programCount: number;
}

export const PROGRAM_LEVELS = ["LISANS", "ONLISANS"] as const;
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

/** One year's placement result. Null means no placement that year — never zero. */
export interface ProgramScoreDto {
  year: number;
  minScore: number | null;
  successRank: number | null;
}

export interface ProgramDto {
  /** 9-digit ÖSYM program code — the identifier printed on official documents. */
  code: string;
  faculty: string;
  name: string;
  level: ProgramLevel;
  durationYears: number;
  /** SAY | EA | SÖZ | DİL | TYT */
  scoreType: string;
  /** Seats offered in `guideYear` — this year's number, NOT the year the scores belong to. */
  quota: number;
  guideYear: number;
  /**
   * Newest year first. An array rather than a single `minScore` so the UI can put years side by
   * side once the next guide lands, instead of overwriting history.
   */
  scores: ProgramScoreDto[];
}

export interface UniversityProgramsDto {
  university: UniversityDto;
  programs: ProgramDto[];
  source: GeoSourceDto | null;
}

/**
 * A university hit carries its city — search results are shown out of context (web + mobile).
 * Nested `CityDto.universities` stay as plain `UniversityDto` (parent supplies the city).
 */
export interface UniversitySearchHitDto extends UniversityDto {
  cityCode: string;
  cityName: string;
}

/** A program hit carries its university and city — search results are shown out of context. */
export interface ProgramSearchHitDto {
  code: string;
  name: string;
  faculty: string;
  level: ProgramLevel;
  universityId: string;
  universityName: string;
  cityCode: string;
  cityName: string;
}

/* ------------------------------- KPSS targets ------------------------------- */

/** A civil-service job name (MÜHENDİS, AVUKAT, VHKİ…). Stable across placement rounds. */
export interface TitleDto {
  id: string;
  name: string;
  slug: string;
}

/**
 * A public institution that appeared in an imported placement round.
 *
 * NOT a catalogue of every public body — only whoever advertised. Always presented alongside the
 * round, and never a required choice, because a user's target may simply not have hired this time.
 */
export interface InstitutionDto {
  id: string;
  name: string;
  slug: string;
}

/** How many vacancies a province carries in the imported round. */
export interface CityPostingCountDto {
  cityCode: string;
  postings: number;
  /** Sum of ADET — people taken, not rows advertised. */
  quota: number;
}

export interface KpssPostingDto {
  osymCode: string;
  round: string;
  /** LISANS | ONLISANS | ORTAOGRETIM */
  educationLevel: string;
  titleName: string;
  institutionName: string;
  cityCode: string;
  district: string | null;
  employmentType: string;
  serviceClass: string | null;
  quota: number;
}

export interface KpssTargetsDto {
  titles: TitleDto[];
  institutions: InstitutionDto[];
  cityPostings: CityPostingCountDto[];
  /** e.g. "2026-1" — shown with every count so nothing reads as a standing state of the world. */
  round: string | null;
  source: GeoSourceDto | null;
}

/* ---------------------------------- search ---------------------------------- */

export const EXAM_FAMILIES_WITH_TARGETS = ["YKS", "KPSS"] as const;
export type ExamFamilyWithTargets = (typeof EXAM_FAMILIES_WITH_TARGETS)[number];

/**
 * One search box, results grouped by kind. Which groups fill depends on the caller's exam family:
 * a KPSS student has no use for university programs, and showing them was the leak this replaced.
 * Irrelevant groups come back empty rather than absent, so the client renders whatever is non-empty.
 */
export interface GeoSearchResultDto {
  cities: Array<Pick<CityDto, "code" | "name" | "slug" | "region">>;
  universities: UniversitySearchHitDto[];
  programs: ProgramSearchHitDto[];
  titles: TitleDto[];
  institutions: InstitutionDto[];
}

export interface CityDto {
  /** Plate code, zero-padded: "01".."81". Stable, doubles as the primary key. */
  code: string;
  name: string;
  slug: string;
  region: GeoRegion;
  /** Empty for every city until the university dataset is seeded. */
  universities: UniversityDto[];
}

/**
 * Trust metadata for the university dataset (roadmap §1 — the UI renders a "source + last
 * verified" badge). Carried ONCE at the response root rather than on all ~208 university rows:
 * they all come from the same editorial import, so repeating it would triple the payload for
 * zero information.
 */
export interface GeoSourceDto {
  source: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface GeoResponseDto {
  cities: CityDto[];
  /** Null while no universities are seeded — cities alone are still fully usable. */
  universitySource: GeoSourceDto | null;
}
