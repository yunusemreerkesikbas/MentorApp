import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole, type MentorshipApplicationDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MentorshipApplicationService } from "../application/mentorship-application.service";
import { SubmitCoachApplicationDto, UpdateCoachProfileDto } from "./mentorship.dto";

/**
 * Becoming a coach (W8 curation, roadmap §5).
 *
 * NO `@Roles` — and that is the whole reason this is its own controller. An applicant is by
 * definition not a coach yet, so `MentorshipCoachController`'s `@Roles(COACH)` would refuse
 * everyone who has a reason to be here; hanging it off the student controller would make that
 * file's name a lie.
 */
@ApiTags("mentorship")
@ApiBearerAuth()
@Controller("mentorship/applications")
export class MentorshipApplicationController {
  constructor(private readonly applications: MentorshipApplicationService) {}

  /**
   * Apply, or re-apply after a rejection.
   *
   * The throttle matches the invite endpoints rather than being tighter, because the real abuse
   * bound is not here: `UNIQUE (user_id)` means one person owns exactly one application row, and
   * `canApply` decides when it may be rewritten. A per-hour limit would mostly punish someone
   * fixing a validation error — the rate limiter counts the 400s too — for a volume the data model
   * already makes impossible. Same reasoning as the invite code carrying no use counter.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitCoachApplicationDto,
  ): Promise<MentorshipApplicationDto> {
    // Read off the caller's own token: every coach today was granted the role by hand, and telling
    // them they have nothing to apply for beats writing a row an admin then has to dismiss.
    return this.applications.submit(user.id, user.roles.includes(UserRole.COACH), dto);
  }

  /**
   * Where my application stands, and the reason if it was refused.
   *
   * `null` (an empty body on the wire) rather than a 404, matching `GET /my-coach`: "you have not
   * applied" is a state, not an error, and a 404 would make the screen render a failure for the
   * most common case there is.
   */
  @Get("mine")
  mine(@CurrentUser() user: RequestUser): Promise<MentorshipApplicationDto | null> {
    return this.applications.findMine(user.id);
  }

  /**
   * The approved coach rewriting the two lines a student reads.
   *
   * Same endpoint family as the application because it IS the application — the approved row is
   * the profile, so there is no second resource and no second screen. Only APPROVED rows accept
   * this (404 otherwise), and the verdict columns are absent from the body: a coach who could
   * edit the institution behind a verified badge would make the badge a lie.
   */
  @Put("mine")
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCoachProfileDto,
  ): Promise<MentorshipApplicationDto> {
    return this.applications.updateProfile(user.id, dto);
  }
}
