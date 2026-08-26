import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { BuddySuggestionRef, BuddyUserRef, BuddyViewDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { BuddyService } from "../../identity/application/buddy.service";
import { BuddyViewService } from "../application/buddy-view.service";

/**
 * How many buddy suggestions the /study-session empty-state list requests. Three, not five:
 * the list is now people you have actually studied with, so it is short by nature — and three
 * rows fit the sidebar column without truncating anyone's name.
 */
const BUDDY_SUGGESTION_LIMIT = 3;

/**
 * Study-buddy (yol arkadaşı) surface. Mutations delegate to identity's BuddyService;
 * the composed GET view (partner effort) is community's aggregation job.
 */
@ApiTags("buddy")
@ApiBearerAuth()
@Controller("buddy")
export class BuddyController {
  constructor(
    private readonly buddy: BuddyService,
    private readonly view: BuddyViewService,
  ) {}

  @Get()
  getView(@CurrentUser() user: RequestUser): Promise<BuddyViewDto> {
    return this.view.getView(user.id);
  }

  @Get("suggestions")
  getSuggestions(@CurrentUser() user: RequestUser): Promise<BuddySuggestionRef[]> {
    return this.view.getSuggestions(user.id, BUDDY_SUGGESTION_LIMIT);
  }

  @Post("requests/:username")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async request(
    @CurrentUser() user: RequestUser,
    @Param("username") username: string,
  ): Promise<{ status: string }> {
    await this.buddy.request(user.id, username);
    return { status: "ok" };
  }

  @Post("requests/:id/accept")
  async accept(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ status: string }> {
    await this.buddy.accept(user.id, id);
    return { status: "ok" };
  }

  @Delete("requests/:id")
  @HttpCode(204)
  async deleteRequest(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.buddy.deleteRequest(user.id, id);
  }

  @Delete()
  @HttpCode(204)
  async end(@CurrentUser() user: RequestUser): Promise<void> {
    await this.buddy.end(user.id);
  }

  @Post("nudge")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async nudge(@CurrentUser() user: RequestUser): Promise<{ status: string }> {
    await this.buddy.nudge(user.id);
    return { status: "ok" };
  }
}
