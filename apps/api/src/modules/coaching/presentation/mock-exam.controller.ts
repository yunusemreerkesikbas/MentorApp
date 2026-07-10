import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { MockExamDto, Paginated } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MockExamService } from "../application/mock-exam.service";
import {
  CreateMockExamDto,
  ListMockExamsQueryDto,
  UpdateMockExamDto,
} from "./coaching.dto";

/** Deneme (mock exam) attempts — authenticated self resource. */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("mock-exams")
export class MockExamController {
  constructor(private readonly mockExams: MockExamService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMockExamDto,
  ): Promise<MockExamDto> {
    return this.mockExams.create(user.id, dto);
  }

  @Get()
  @ApiQuery({ name: "examId", required: false, type: String, format: "uuid" })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMockExamsQueryDto,
  ): Promise<Paginated<MockExamDto>> {
    return this.mockExams.list(user.id, query);
  }

  @Get(":id")
  getById(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MockExamDto> {
    return this.mockExams.getById(user.id, id);
  }

  @Put(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMockExamDto,
  ): Promise<MockExamDto> {
    return this.mockExams.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.mockExams.remove(user.id, id);
  }
}
