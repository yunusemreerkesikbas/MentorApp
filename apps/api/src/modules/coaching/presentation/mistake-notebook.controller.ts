import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type {
  NotebookEntryDto,
  NotebookImageUploadUrlDto as NotebookImageUploadUrlResponse,
  NotebookOverviewDto,
  NotebookPageDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MistakeNotebookService } from "../application/mistake-notebook.service";
import {
  CreateNotebookEntryDto,
  LinkNotebookThreadDto,
  NotebookImageUploadUrlDto,
  PutNotebookPageDto,
  ReviewNotebookEntryDto,
  UpdateNotebookEntryDto,
} from "./coaching.dto";

/**
 * Mistake notebook ("yanlış defteri") — authenticated self resource (global JwtAuthGuard applies).
 *
 * Free tier, deliberately: the notebook and its review loop are the habit engine, and gating the
 * thing that brings a user back would be gating retention. Premium sits one layer in — vision
 * pre-labelling lives on the AI controller, and the AI pattern reading on the analysis surface.
 */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching/notebook")
export class MistakeNotebookController {
  constructor(private readonly notebook: MistakeNotebookService) {}

  @Get()
  getOverview(@CurrentUser() user: RequestUser): Promise<NotebookOverviewDto> {
    return this.notebook.getOverview(user.id);
  }

  /** Entries whose review moment has arrived — the "bugün tekrar" strip. */
  @Get("reviews/due")
  listDue(@CurrentUser() user: RequestUser): Promise<NotebookEntryDto[]> {
    return this.notebook.listDue(user.id);
  }

  @Post("entries/image-upload-url")
  createUploadUrl(
    @CurrentUser() user: RequestUser,
    @Body() dto: NotebookImageUploadUrlDto,
  ): Promise<NotebookImageUploadUrlResponse> {
    return this.notebook.createUploadUrl(user.id, dto.contentType);
  }

  @Post("entries")
  createEntry(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNotebookEntryDto,
  ): Promise<NotebookEntryDto> {
    return this.notebook.createEntry(user.id, dto);
  }

  @Patch("entries/:id")
  updateEntry(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotebookEntryDto,
  ): Promise<NotebookEntryDto> {
    return this.notebook.updateEntry(user.id, id, dto);
  }

  /** "Could you do it this time?" — one boolean, and the interval ladder does the rest. */
  @Post("entries/:id/review")
  @HttpCode(HttpStatus.OK)
  reviewEntry(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewNotebookEntryDto,
  ): Promise<NotebookEntryDto> {
    return this.notebook.reviewEntry(user.id, id, dto.solved);
  }

  /**
   * Record the forum thread the user just asked this mistake in.
   *
   * The client creates the thread through the forum API first and posts the id here — coaching
   * never calls into forum. The reverse direction (an accepted answer landing back on the card) is
   * a domain-event listener, not a call either.
   */
  @Post("entries/:id/community-thread")
  @HttpCode(HttpStatus.OK)
  linkThread(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LinkNotebookThreadDto,
  ): Promise<NotebookEntryDto> {
    return this.notebook.linkCommunityThread(user.id, id, dto.threadId);
  }

  @Delete("entries/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEntry(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notebook.deleteEntry(user.id, id);
  }

  /** A page the user has never saved comes back empty — turning to a blank page is not a 404. */
  @Get("pages/:index")
  getPage(
    @CurrentUser() user: RequestUser,
    @Param("index", ParseIntPipe) index: number,
  ): Promise<NotebookPageDto> {
    return this.notebook.getPage(user.id, index);
  }

  @Put("pages/:index")
  putPage(
    @CurrentUser() user: RequestUser,
    @Param("index", ParseIntPipe) index: number,
    @Body() dto: PutNotebookPageDto,
  ): Promise<NotebookPageDto> {
    return this.notebook.putPage(user.id, index, dto.doc);
  }
}
