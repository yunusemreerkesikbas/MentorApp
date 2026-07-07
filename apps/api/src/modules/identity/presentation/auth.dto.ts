import {
  avatarUploadUrlSchema,
  forgotPasswordSchema,
  googleOAuthCallbackQuerySchema,
  googleOAuthStartQuerySchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateMeSchema,
  verifyEmailSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class GoogleOAuthStartQueryDto extends createZodDto(googleOAuthStartQuerySchema) {}
export class GoogleOAuthCallbackQueryDto extends createZodDto(googleOAuthCallbackQuerySchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class UpdateMeDto extends createZodDto(updateMeSchema) {}
export class AvatarUploadUrlDto extends createZodDto(avatarUploadUrlSchema) {}
