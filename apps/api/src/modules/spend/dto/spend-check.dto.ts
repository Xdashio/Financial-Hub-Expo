import { IsNumber, IsString, IsEnum, IsOptional, IsUUID, Min } from 'class-validator';

export class SpendCheckDto {
  @IsUUID()
  pocket_id: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  recipient_key?: string;

  @IsOptional()
  @IsEnum(['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified'])
  category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified';
}