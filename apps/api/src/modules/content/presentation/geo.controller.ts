import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { GeoResponseDto } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { GeoService } from "../application/geo.service";

/**
 * Public geo reference — provinces + universities for the panel's goal map.
 *
 * One endpoint returning everything (~30KB) rather than a list + per-city detail: the map reads
 * this once and answers every hover locally. Cached for a day; the underlying dataset is an
 * editorial import that changes about once a year.
 */
@ApiTags("content")
@Public()
@Controller("content/geo")
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=86400")
  getGeo(): Promise<GeoResponseDto> {
    return this.geo.getGeo();
  }
}
