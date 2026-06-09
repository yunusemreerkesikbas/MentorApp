import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { UsersService } from "../application/users.service";
import { UpdateMeDto } from "./auth.dto";

/** Authenticated self endpoints (global JwtAuthGuard applies — no @Public here). */
@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.users.getMe(user.id);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateMeDto): Promise<AuthUser> {
    return this.users.updateMe(user.id, dto);
  }
}
