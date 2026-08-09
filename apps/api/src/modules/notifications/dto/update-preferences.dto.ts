import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  reallocation_confirms?: boolean;

  @IsOptional()
  @IsBoolean()
  cooling_off_reminders?: boolean;

  @IsOptional()
  @IsBoolean()
  savings_milestones?: boolean;

  @IsOptional()
  @IsBoolean()
  monthly_insights?: boolean;

  @IsOptional()
  @IsBoolean()
  tips_nudges?: boolean;
}