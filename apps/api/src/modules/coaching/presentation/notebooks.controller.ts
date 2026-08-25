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
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type {
  NotebookDto,
  NotebookPageDto,
  NotebookSummaryDto,
  Paginated,
} from "@mentor/types";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { MistakeNotebookService } from "../application/mistake-notebook.service";
import {
  CreateNotebookDto,
  ListNotebooksQueryDto,
  PutNotebookPageDto,
  UpdateNotebookDto,
} from "./coaching.dto";

@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching/notebooks")
export class NotebooksController {
  constructor(private readonly notebooks: MistakeNotebookService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListNotebooksQueryDto,
  ): Promise<Paginated<NotebookSummaryDto>> {
    return this.notebooks.listNotebooks(
      { userId: user.id, orgId: user.orgId },
      query,
    );
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNotebookDto,
  ): Promise<NotebookDto> {
    return this.notebooks.createNotebook(
      { userId: user.id, orgId: user.orgId },
      dto,
    );
  }

  @Get(":id")
  get(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<NotebookDto> {
    return this.notebooks.getNotebook(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotebookDto,
  ): Promise<NotebookDto> {
    return this.notebooks.updateNotebook(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notebooks.deleteNotebook(user.id, id);
  }

  @Get(":id/pages/:index")
  getPage(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("index", ParseIntPipe) index: number,
  ): Promise<NotebookPageDto> {
    return this.notebooks.getNotebookPage(user.id, id, index);
  }

  @Put(":id/pages/:index")
  putPage(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("index", ParseIntPipe) index: number,
    @Body() dto: PutNotebookPageDto,
  ): Promise<NotebookPageDto> {
    return this.notebooks.putNotebookPage(user.id, id, index, dto.doc);
  }
}
