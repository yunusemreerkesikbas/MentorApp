import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateMeSchema,
  verifyEmailSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class UpdateMeDto extends createZodDto(updateMeSchema) {}
