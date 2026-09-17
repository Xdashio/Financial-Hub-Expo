import { BadRequestException } from '@nestjs/common';
import { MAX_MONEY_AMOUNT } from '@financial-hub/shared';

/**
 * Server-side money bounds (M1). DTOs enforce the ceiling declaratively via
 * `@Max(MAX_MONEY_AMOUNT)`; `@IsNumber()` already rejects NaN/Infinity (see
 * class-validator's isNumber — both default to disallowed). Service entry
 * points that accept inline `{ amount: number }` bodies (no DTO class) call
 * `assertMoneyAmount()` instead, so the "server-side always" rule holds on
 * every path, not just the class-validator ones.
 */
export { MAX_MONEY_AMOUNT };

/** Throw 400 unless `value` is a finite number within 0..MAX_MONEY_AMOUNT. */
export function assertMoneyAmount(value: unknown, field = 'amount', opts: { min?: number } = {}): asserts value is number {
  const min = opts.min ?? 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > MAX_MONEY_AMOUNT) {
    throw new BadRequestException(
      `${field} must be a finite number between ${min} and ${MAX_MONEY_AMOUNT}`,
    );
  }
}
