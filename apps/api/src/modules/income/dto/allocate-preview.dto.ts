import { IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../../common/money-limits';

export class AllocatePreviewDto {
  @IsNumber()
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @IsEnum(['client_payment', 'cash', 'other'])
  source: 'client_payment' | 'cash' | 'other';

  /** Which segment's active plan this allocation preview targets (ADR-001
   *  §5.1). Defaults to 'individual' for backward compat. */
  @IsOptional()
  @IsEnum(['individual', 'msme'])
  segment?: 'individual' | 'msme';
}