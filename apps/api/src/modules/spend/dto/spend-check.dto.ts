import { IsNumber, IsString, IsEnum, IsOptional, IsUUID, Min, MinLength, MaxLength } from 'class-validator';

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

  /** Client-generated key so a timeout+retry does not double-record a spend. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotency_key?: string;

  /**
   * Set only on a resubmission after the client showed the user a
   * `block_reason: 'insufficient_funds'` response and they chose "spend
   * anyway" over adjusting the pocket's allocation or cancelling
   * (audit_team.md item 4/5). Has no effect on any other block reason —
   * blocked_category / pocket_time_locked stay hard blocks regardless.
   */
  @IsOptional()
  override?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  override_reason?: string;

  /**
   * Set to true when the user confirms the overflow/borrow flow (subpocket-feature-spec.md §5).
   * This triggers an immediate parent-to-child reallocation before the spend proceeds.
   */
  @IsOptional()
  borrow_from_parent?: boolean;
}