import { IsString, IsBoolean, IsEnum, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../../common/money-limits';

export class ClassifyDto {
  @IsString()
  recipient_key: string;

  @IsEnum(['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified'])
  category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified';

  @IsUUID()
  pocket_id: string;

  @IsBoolean()
  remember: boolean;

  @IsOptional()
  @IsString()
  transaction_id?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}