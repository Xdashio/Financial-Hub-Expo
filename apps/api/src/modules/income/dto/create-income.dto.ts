import { IsNumber, IsString, IsBoolean, IsEnum, IsOptional, IsDateString, Min, MaxLength, MinLength } from 'class-validator';

export class CreateIncomeDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(['client_payment', 'cash', 'other'])
  source: 'client_payment' | 'cash' | 'other';

  @IsString()
  @IsOptional()
  label?: string;

  @IsDateString()
  date: string;

  @IsBoolean()
  run_allocation: boolean;

  /** Client-generated key so a timeout+retry does not double-credit income. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotency_key?: string;
}
