import { Get } from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { PhotoAccessDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PhotoAccessService } from "../application/photo-access.service";

/** Premium photo → subject categorization access probe (W3). */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiPhotoController {
  constructor(private readonly photoAccess: PhotoAccessService) {}

  @Get("photo-access")
  getPhotoAccess(@CurrentUser() user: RequestUser): Promise<PhotoAccessDto> {
    return this.photoAccess.getAccess(user.id, user.roles);
  }
}
