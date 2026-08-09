import { IsString, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

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
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}