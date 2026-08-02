import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiTags } from "@nestjs/swagger";
import type {
  GeoResponseDto,
  GeoSearchResultDto,
  KpssPostingDto,
  KpssTargetsDto,
  UniversityProgramsDto,
} from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { GeoService } from "../application/geo.service";
import { KpssService } from "../application/kpss.service";
import { GeoSearchQueryDto } from "./content.dto";

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
   */
  @Get("geo/search")
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
}
