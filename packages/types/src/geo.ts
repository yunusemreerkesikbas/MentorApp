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
