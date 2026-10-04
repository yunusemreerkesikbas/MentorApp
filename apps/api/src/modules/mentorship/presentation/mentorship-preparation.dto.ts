import { ApiProperty } from "@nestjs/swagger";

export class MentorshipPreparationObservationResponseDto {
  @ApiProperty() text!: string;
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
}

export class MentorshipMeetingPreparationResponseDto {
  @ApiProperty({ enum: [1] }) version!: 1;
  @ApiProperty({ type: MentorshipPreparationObservationResponseDto })
  focus!: MentorshipPreparationObservationResponseDto;
  @ApiProperty({
    type: MentorshipPreparationObservationResponseDto,
    nullable: true,
  })
  progress!: MentorshipPreparationObservationResponseDto | null;
  @ApiProperty() uncertainty!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ type: String, nullable: true }) nextStep!: string | null;
}
