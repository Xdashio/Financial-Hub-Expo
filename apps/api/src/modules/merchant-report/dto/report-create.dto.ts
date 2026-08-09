import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ReportCreateDto {
  @IsString()
  recipient_key: string;

  @IsEnum(['wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee'])
  report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  transaction_id?: string;

  @IsOptional()
  @IsString()
  suggested_category?: string;
}