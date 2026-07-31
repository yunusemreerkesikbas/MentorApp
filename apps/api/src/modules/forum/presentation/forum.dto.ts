import {
  approveMemberSchema,
  adminForumTagCreateSchema,
  adminForumTagUpdateSchema,
  assignOwnerSchema,
  attachmentUploadUrlSchema,
  bookmarkQuerySchema,
  createAnswerSchema,
  createReportSchema,
  createThreadSchema,
  createZoneSchema,
  feedQuerySchema,
  forumFeedQuerySchema,
  forumSearchQuerySchema,
  memberSearchQuerySchema,
  pinThreadSchema,
  reactionSchema,
  reportsQuerySchema,
  resolveReportSchema,
  searchQuerySchema,
  setFeaturedThreadSchema,
  updateForumPostSchema,
  updateForumThreadSchema,
  zoneListQuerySchema,
  zoneMembersQuerySchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreateZoneDto extends createZodDto(createZoneSchema) {}
export class AssignOwnerDto extends createZodDto(assignOwnerSchema) {}
export class ApproveMemberDto extends createZodDto(approveMemberSchema) {}
export class ZoneListQueryDto extends createZodDto(zoneListQuerySchema) {}
export class ZoneMembersQueryDto extends createZodDto(zoneMembersQuerySchema) {}
export class MemberSearchQueryDto extends createZodDto(memberSearchQuerySchema) {}
export class CreateThreadDto extends createZodDto(createThreadSchema) {}
export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
export class BookmarkQueryDto extends createZodDto(bookmarkQuerySchema) {}
export class ReactionDto extends createZodDto(reactionSchema) {}
export class PinThreadDto extends createZodDto(pinThreadSchema) {}
export class CreateAnswerDto extends createZodDto(createAnswerSchema) {}
export class AttachmentUploadUrlDto extends createZodDto(attachmentUploadUrlSchema) {}
export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
export class CreateReportDto extends createZodDto(createReportSchema) {}
export class ReportsQueryDto extends createZodDto(reportsQuerySchema) {}
export class ResolveReportDto extends createZodDto(resolveReportSchema) {}
export class ForumFeedQueryDto extends createZodDto(forumFeedQuerySchema) {}
export class ForumSearchQueryDto extends createZodDto(forumSearchQuerySchema) {}
export class UpdateForumThreadDto extends createZodDto(updateForumThreadSchema) {}
export class UpdateForumPostDto extends createZodDto(updateForumPostSchema) {}
export class AdminForumTagCreateDto extends createZodDto(adminForumTagCreateSchema) {}
export class AdminForumTagUpdateDto extends createZodDto(adminForumTagUpdateSchema) {}
export class SetFeaturedThreadDto extends createZodDto(setFeaturedThreadSchema) {}
