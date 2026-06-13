import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MockExamDto, Paginated } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { MockExamService } from "../application/mock-exam.service";
import { CreateMockExamDto, ListMockExamsQueryDto } from "./coaching.dto";

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
}
