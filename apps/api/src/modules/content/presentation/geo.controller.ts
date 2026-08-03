import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  CampusExperienceDto,
  GeoResponseDto,
  GeoSearchResultDto,
  CityPostingCountDto,
  KpssPostingDto,
  KpssTargetsDto,
  ProgramCatalogSearchResponseDto,
  UniversityProgramsDto,
} from "@mentor/types";
import { I18nContext } from "nestjs-i18n";
import { Public } from "../../../common/auth/public.decorator";
import { GeoService } from "../application/geo.service";
import { KpssService } from "../application/kpss.service";
import { PreferenceCatalogService } from "../application/preference-catalog.service";
import { GeoSearchQueryDto, ProgramCatalogSearchQueryDto } from "./content.dto";

/** A day; the underlying dataset is an editorial import that changes about once a year. */
const REFERENCE_MAX_AGE = 86400;

/**
 * Public geo reference — provinces, universities and programs behind the goal map.
 *
 * The country payload and the per-university programs are separate on purpose: `/geo` is ~50KB
 * and read once, while the ~21.5k programs are only ever wanted for the one university a user
 * just opened.
 */
@ApiTags("content")
@Public()
@Controller("content")
export class GeoController {
  constructor(
    private readonly geo: GeoService,
    private readonly kpss: KpssService,
    private readonly preferenceCatalog: PreferenceCatalogService,
  ) {}

  /**
   * Cache headers are set AFTER each read succeeds, never via `@Header`.
   *
   * `@Header` writes before the handler runs, so it survives onto an error response too — and
   * `public, max-age=86400` on a 500 tells every browser and CDN to serve that failure for a full
   * day without asking again. A transient error then looks permanent, and restarting the server
   * changes nothing because the request never leaves the client.
   */
  @Get("geo")
  async getGeo(
    @Res({ passthrough: true }) res: Response,
  ): Promise<GeoResponseDto> {
    const geo = await this.geo.getGeo();
    res.setHeader("Cache-Control", `public, max-age=${REFERENCE_MAX_AGE}`);
    return geo;
  }

  /**
   * Search is deliberately NOT cached: it is per-keystroke and the response varies by `q`, so a
   * shared cache would mostly store single-use entries.
   *
   * The `@ApiQuery` pair is what makes this callable from the generated client at all: the DTO is a
   * `createZodDto`, which carries no Swagger metadata, so without these orval emits
   * `geoControllerSearch()` with no parameters and every caller has to hand-roll a fetch. Zod still
   * owns validation — these only describe the shape to the spec.
   */
  @Get("geo/search")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "family", required: false, enum: ["YKS", "KPSS"] })
  search(@Query() query: GeoSearchQueryDto): Promise<GeoSearchResultDto> {
    return this.geo.search(query.q, query.family);
  }

  /**
   * KPSS reference data — titles, the institutions that advertised, and per-province vacancy
   * counts. Separate from `/geo` so a YKS student never downloads it, and vice versa.
   */
  @Get("kpss-targets")
  async getKpssTargets(
    @Res({ passthrough: true }) res: Response,
  ): Promise<KpssTargetsDto> {
    const targets = await this.kpss.getTargets();
    res.setHeader("Cache-Control", `public, max-age=${REFERENCE_MAX_AGE}`);
    return targets;
  }

  /**
   * Per-province vacancy counts, narrowed by the same term the search box holds — the KPSS
   * counterpart of filtering campus pins as a YKS student types.
   *
   * Not cached: like `geo/search` it varies per keystroke, so a shared cache would mostly hold
   * single-use entries.
   */
  @Get("kpss-targets/city-counts")
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiQuery({ name: "titleId", required: false, type: String })
  getKpssCityCounts(
    @Query("q") q?: string,
    @Query("titleId") titleId?: string,
  ): Promise<CityPostingCountDto[]> {
    return this.kpss.getCityCounts(q, titleId);
  }

  /**
   * The vacancies advertised in one province — loaded when a city is opened, not up front.
   *
   * A named `@Param` rather than a Zod DTO: `createZodDto` carries no Swagger metadata, so orval
   * sees `:cityCode` in the path with no matching parameter and refuses to generate the client.
   * An unknown plate code is harmless here — it simply matches no rows.
   */
  @Get("kpss-targets/cities/:cityCode")
  async getKpssCityPostings(
    @Param("cityCode") cityCode: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KpssPostingDto[]> {
    const postings = await this.kpss.getCityPostings(cityCode);
    res.setHeader("Cache-Control", `public, max-age=${REFERENCE_MAX_AGE}`);
    return postings;
  }

  @Get("universities/:id/programs")
  async getUniversityPrograms(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UniversityProgramsDto> {
    const result = await this.geo.getUniversityPrograms(id);
    res.setHeader("Cache-Control", `public, max-age=${REFERENCE_MAX_AGE}`);
    return result;
  }

  /** Versioned, official and paginated YKS catalogue for the preference builder. */
  @Get("programs/search")
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({
    name: "scoreType",
    required: false,
    enum: ["SAY", "EA", "SÖZ", "DİL", "TYT"],
  })
  searchPrograms(
    @Query() query: ProgramCatalogSearchQueryDto,
  ): Promise<ProgramCatalogSearchResponseDto> {
    return this.preferenceCatalog.search(
      query.q,
      query.page,
      query.pageSize,
      query.scoreType,
    );
  }

  /** Enabled editorial 3D campus tour; unavailable pilots deliberately return 404. */
  @Get("universities/:id/campus-experience")
  getCampusExperience(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CampusExperienceDto> {
    return this.preferenceCatalog.getCampusExperience(
      id,
      I18nContext.current()?.lang ?? "tr",
    );
  }
}
