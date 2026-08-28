import { IsEnum, IsString, IsOptional, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class AllocateSurplusDto {
  @IsEnum(['main_pocket', 'pocket', 'new_pocket', 'savings'])
  target: 'main_pocket' | 'pocket' | 'new_pocket' | 'savings';

  @IsOptional()
  @IsEnum(['individual', 'msme'])
  segment?: 'individual' | 'msme';

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  pocket_id?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  new_pocket_name?: string;
}
