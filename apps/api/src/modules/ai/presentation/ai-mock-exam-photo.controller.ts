import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type {
  CategorizePhotoResultDto,
  NotebookPrelabelDto,
  PhotoUploadUrlDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PhotoCategorizeService } from "../application/photo-categorize.service";
import { PhotoUploadService } from "../application/photo-upload.service";
import {
  CategorizePhotoDto,
  PhotoUploadUrlDto as PhotoUploadUrlBodyDto,
  PrelabelNotebookEntryDto,
} from "./ai.dto";

/**
 * Mock-exam photo upload + vision categorize (W3). Lives in AI module to avoid coaching↔ai circular imports.
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("mock-exams")
export class AiMockExamPhotoController {
  constructor(
    private readonly photoUpload: PhotoUploadService,
    private readonly photoCategorize: PhotoCategorizeService,
  ) {}

  @Post("photo-upload-url")
  createPhotoUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: PhotoUploadUrlBodyDto,
  ): Promise<PhotoUploadUrlDto> {
    return this.photoUpload.createUploadUrl(user.id, user.roles, dto.contentType);
  }

  @Post(":id/categorize-photo")
  categorizePhoto(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CategorizePhotoDto,
  ): Promise<CategorizePhotoResultDto> {
    return this.photoCategorize.categorize(user.id, user.roles, id, dto);
  }
}

/**
 * Notebook photo pre-labelling. A separate controller because it is a different resource, and it
 * lives in the AI module for the same reason the one above does: coaching cannot import vision
 * without a circular module edge.
 */
@ApiTags("ai")
@ApiBearerAuth()
@Controller("coaching/notebook")
export class AiNotebookPrelabelController {
  constructor(private readonly photoCategorize: PhotoCategorizeService) {}

  @Post("entries/prelabel")
  @HttpCode(HttpStatus.OK)
  prelabel(
    @CurrentUser() user: RequestUser,
    @Body() dto: PrelabelNotebookEntryDto,
  ): Promise<NotebookPrelabelDto> {
    return this.photoCategorize.prelabelNotebookPhoto(user.id, user.roles, dto);
  }
}
