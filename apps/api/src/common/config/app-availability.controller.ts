import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AppAvailabilityDto } from "@mentor/types";
import { Public } from "../auth/public.decorator";
import { AppAvailabilityService } from "./app-availability.service";

@Public()
@ApiTags("app")
@Controller("app")
export class AppAvailabilityController {
  constructor(private readonly availability: AppAvailabilityService) {}

  @Get("availability")
  @Header("Cache-Control", "no-store")
  get(): Promise<AppAvailabilityDto> {
    return this.availability.get();
  }
}
