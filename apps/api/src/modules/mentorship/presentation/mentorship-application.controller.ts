import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type {
  MentorshipApplicationDto,
  MentorshipCoachRegistrationStateDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MentorshipApplicationService } from "../application/mentorship-application.service";
import { RegisterCoachDto, UpdateCoachProfileDto } from "./mentorship.dto";

/**
 * Becoming a coach (W8 self-service registration — roadmap §5, revised by APP-089).
 *
 * NO `@Roles` — and that is the whole reason this is its own controller. Somebody registering is by
 * definition not a coach yet, so `MentorshipCoachController`'s `@Roles(COACH)` would refuse everyone
 * who has a reason to be here; hanging it off the student controller would make that file's name a
 * lie. It is also the door an admin-designated coach walks through to write their own profile.
 */
@ApiTags("mentorship")
@ApiBearerAuth()
@Controller("mentorship/coach-registration")
export class MentorshipApplicationController {
  constructor(private readonly applications: MentorshipApplicationService) {}

  /**
   * Register as a coach. Writes the registry row and grants COACH.
   *
   * The throttle matches the invite endpoints rather than being tighter, because the real abuse
   * bound is not here: `UNIQUE (user_id)` means one person owns exactly one registry row, and
   * `canRegister` refuses to rewrite an existing one. A per-hour limit would mostly punish someone
   * fixing a validation error — the rate limiter counts the 400s too — for a volume the data model
   * already makes impossible. Same reasoning as the invite code carrying no use counter.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegisterCoachDto,
  ): Promise<MentorshipApplicationDto> {
    return this.applications.register(user.id, dto);
  }

  /**
   * Am I a coach, is the intake open, and does my invite code work yet.
   *
   * One call rather than three because every screen that asks one of these asks all of them: the
   * registration form needs `registrationOpen` BEFORE it is filled in (the old endpoint only
   * revealed a closed intake by rejecting a completed submission), and the coach panel needs
   * `emailVerified` to explain a locked invite code.
   *
   * `registration: null` rather than a 404, matching `GET /my-coach`: "you have not registered" is
   * a state, not an error, and a 404 would render a failure for the most common case there is.
   */
  @Get("mine")
  mine(@CurrentUser() user: RequestUser): Promise<MentorshipCoachRegistrationStateDto> {
    return this.applications.getRegistrationState(user.id);
  }

  /**
   * The coach rewriting the two lines a student reads.
   *
   * Same endpoint family as registration because it IS the registration — the ACTIVE row is the
   * profile, so there is no second resource and no second screen. Only ACTIVE rows accept this
   * (404 otherwise), and the admin's columns are absent from the body: a coach who could edit the
   * institution behind a verified badge would make the badge a lie.
   */
  @Put("mine")
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCoachProfileDto,
  ): Promise<MentorshipApplicationDto> {
    return this.applications.updateProfile(user.id, dto);
  }
}
