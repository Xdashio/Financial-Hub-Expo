import { IsNumber, IsString, IsBoolean, IsEnum, IsOptional, IsDateString, IsObject, Min, Max, MaxLength, MinLength } from 'class-validator';
import { MAX_MONEY_AMOUNT } from '../../../common/money-limits';

export class CreateIncomeDto {
  @IsNumber()
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount: number;

  @IsEnum(['client_payment', 'cash', 'other'])
  source: 'client_payment' | 'cash' | 'other';

  /** Which segment's active plan this income feeds (ADR-001 §5.1). Defaults
   *  to 'individual' for backward compat. */
  @IsOptional()
  @IsEnum(['individual', 'msme'])
  segment?: 'individual' | 'msme';

  @IsString()
  @IsOptional()
  label?: string;

  @IsDateString()
  date: string;

  @IsBoolean()
  run_allocation: boolean;

  /**
   * Per-event override for a parent pocket's sub-pocket split (Add Income
   * preview's expandable editor — SUB_POCKET_SPLITS spec §3). Keyed by the
   * parent pocket's id; each entry's amounts don't need to sum to the
   * parent's full share — whatever isn't covered stays with the parent as
   * its normal (reserved) allocation for this event. Only overrides *this*
   * event; the pocket's stored `splitPercentage` (and therefore future
   * events) is untouched. Validated loosely here (shape only) — the
   * service clamps amounts against the parent's actual computed share, so
   * a malformed or over-budget override can't over-allocate the ledger.
   */
  @IsOptional()
  @IsObject()
  sub_split_overrides?: Record<string, Array<{ pocketId: string; amount: number }>>;

  /** Client-generated key so a timeout+retry does not double-credit income. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotency_key?: string;
}