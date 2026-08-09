import { IsNumber, IsString, IsBoolean, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';

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
}