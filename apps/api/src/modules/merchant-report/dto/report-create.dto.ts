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
  @IsEnum(['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified'])
  suggested_category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified';
}