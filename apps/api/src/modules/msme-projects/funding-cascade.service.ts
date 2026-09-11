import { Injectable } from '@nestjs/common';
import { sumMoney, netMoney } from '@financial-hub/shared';
import { FundingTierSchema } from '@financial-hub/shared';

export type FundingTier = 'priorities' | 'needs' | 'wants';
export type TierStatus = 'in_progress' | 'complete';

export interface TierState {
  tier: FundingTier;
  targetAmount: number;
  allocatedAmount: number;
  spentAmount: number;
}

export interface AllocationResult {
  allocations: { tier: FundingTier; amount: number }[];
  excessAmount: number;
  nextTier: FundingTier | null;
  allTiersComplete: boolean;
}

export interface SpendingResult {
  tier: FundingTier;
  spentAmount: number;
  remainingCash: number;
}

/**
 * Pure logic service for the Funding Cascade Engine (§11–§15).
 * 
 * Core rule: income flows forward through Priorities(1) → Needs(2) → Wants(3).
 * A tier is 'complete' when allocated >= target. Excess stops at Wants and
 * triggers an excess prompt (§21).
 * 
 * This service contains NO database calls — only pure functions for:
 * - Calculating allocation flows
 * - Determining funding status
 * - Computing spending against tiers
 * - Handling excess prompts
 * 
 * The orchestration layer (ProjectsService) calls these functions and persists results.
 */
@Injectable()
export class FundingCascadeService {
  readonly TIER_ORDER: FundingTier[] = ['priorities', 'needs', 'wants'];

  /**
   * Determines if a tier is funded (complete) based on allocated vs target.
   * A tier is complete when allocated_amount >= target_amount.
   */
  isTierComplete(tier: TierState): boolean {
    return tier.allocatedAmount >= tier.targetAmount;
  }

  /**
   * Calculates the funding percentage for a tier (0-100).
   * Capped at 100% for display purposes.
   */
  getFundingPercent(tier: TierState): number {
    if (!tier.targetAmount || tier.targetAmount <= 0) {
      return 0;
    }
    const percent = (tier.allocatedAmount / tier.targetAmount) * 100;
    return Math.min(100, Math.max(0, Math.round(percent * 100) / 100));
  }

  /**
   * Calculates remaining cash available in a tier (allocated - spent).
   * Cannot go below zero.
   */
  getRemainingCash(tier: TierState): number {
    return Math.max(0, tier.allocatedAmount - tier.spentAmount);
  }

  /**
   * Determines which tier the next income should flow to.
   * Returns the first incomplete tier in order, or null if all complete.
   */
  getNextIncomeTier(tiers: TierState[]): FundingTier | null {
    // Sort by cascade order to ensure correct flow
    const sortedTiers = [...tiers].sort((a, b) => this.TIER_ORDER.indexOf(a.tier) - this.TIER_ORDER.indexOf(b.tier));
    for (const tier of sortedTiers) {
      if (!this.isTierComplete(tier)) {
        return tier.tier;
      }
    }
    return null;
  }

  /**
   * Calculates how much of an income amount can be allocated to a specific tier.
   * Returns the amount that fits within the tier's remaining target.
   */
  calculateTierCapacity(tier: TierState): number {
    const remainingTarget = tier.targetAmount - tier.allocatedAmount;
    return Math.max(0, remainingTarget);
  }

  /**
   * Pure allocation logic: flows income forward through tiers in order.
   * 
   * Algorithm (§17:385):
   * 1. Start at the first incomplete tier
   * 2. Fill it up to target_amount
   * 3. Any remainder flows to the next tier
   * 4. Excess beyond Wants becomes excessAmount (triggers prompt)
   * 
   * @param incomeAmount - The income amount to allocate
   * @param tiers - Current state of all three tiers (must be in sort_order 1,2,3)
   * @returns AllocationResult with per-tier allocations, excess, and next tier
   */
  allocateIncome(incomeAmount: number, tiers: TierState[]): AllocationResult {
    // Sort tiers by sort_order to ensure correct cascade flow
    const sortedTiers = [...tiers].sort((a, b) => this.TIER_ORDER.indexOf(a.tier) - this.TIER_ORDER.indexOf(b.tier));
    
    let remaining = incomeAmount;
    const allocations: { tier: FundingTier; amount: number }[] = [];
    
    // Track updated allocated amounts for subsequent checks
    const updatedTiers = sortedTiers.map(t => ({ ...t }));
    
    for (const tier of updatedTiers) {
      if (remaining <= 0) break;
      
      const capacity = this.calculateTierCapacity(tier);
      const allocated = Math.min(remaining, capacity);
      
      if (allocated > 0) {
        allocations.push({ tier: tier.tier, amount: allocated });
        tier.allocatedAmount += allocated; // Update for subsequent checks
        remaining -= allocated;
      }
    }
    
    const excessAmount = remaining; // What couldn't fit in any tier
    const nextTier = this.getNextIncomeTier(updatedTiers);
    const allTiersComplete = updatedTiers.every(t => this.isTierComplete(t));
    
    return {
      allocations,
      excessAmount,
      nextTier,
      allTiersComplete,
    };
  }

  /**
   * Calculates the allocation preview for a hypothetical income amount.
   * Useful for showing "if X income arrives, it will go to Y tier".
   */
  previewAllocation(incomeAmount: number, tiers: TierState[]): AllocationResult {
    return this.allocateIncome(incomeAmount, tiers);
  }

  /**
   * Validates that tier targets sum to the project's contract value.
   * Tolerance of 0.01 for floating point math.
   */
  validateTierTargets(tiers: TierState[], contractValue: number): boolean {
    const totalTargets = sumMoney(tiers.map(t => t.targetAmount));
    return Math.abs(totalTargets - contractValue) < 0.01;
  }

  /**
   * Validates that all three tiers exist with correct sort_order.
   */
  validateTierStructure(tiers: TierState[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (tiers.length !== 3) {
      errors.push('Exactly 3 tiers required');
    }
    
    const expectedOrder = ['priorities', 'needs', 'wants'];
    const actualTiers = tiers.map(t => t.tier).sort((a, b) => this.TIER_ORDER.indexOf(a) - this.TIER_ORDER.indexOf(b));
    
    for (let i = 0; i < 3; i++) {
      if (actualTiers[i] !== expectedOrder[i]) {
        errors.push(`Tier at position ${i + 1} must be '${expectedOrder[i]}', got '${actualTiers[i]}'`);
      }
    }
    
    const hasDuplicateTiers = new Set(tiers.map(t => t.tier)).size !== 3;
    if (hasDuplicateTiers) {
      errors.push('Duplicate tier names found');
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Handles spending against a tier.
   * Spending reduces the available cash in a tier but does NOT affect funding status.
   * Returns the new spent amount and remaining cash.
   */
  recordSpending(tier: TierState, amount: number): SpendingResult {
    if (amount <= 0) {
      throw new Error('Spending amount must be positive');
    }
    
    const newSpentAmount = sumMoney([tier.spentAmount, amount]);
    const remainingCash = this.getRemainingCash({ ...tier, spentAmount: newSpentAmount });
    
    if (newSpentAmount > tier.allocatedAmount) {
      throw new Error(`Spending amount ${amount} exceeds allocated cash ${tier.allocatedAmount}`);
    }
    
    return {
      tier: tier.tier,
      spentAmount: newSpentAmount,
      remainingCash,
    };
  }

  /**
   * Calculates project-level summary from tier states.
   */
  calculateProjectSummary(
    projectId: string,
    name: string,
    kind: string,
    contractValue: number,
    status: string,
    isActiveCascade: boolean,
    tiers: TierState[]
  ): {
    id: string;
    name: string;
    kind: string;
    contractValue: number;
    status: string;
    isActiveCascade: boolean;
    tiers: Array<{
      tier: FundingTier;
      sortOrder: number;
      targetAmount: number;
      allocatedAmount: number;
      spentAmount: number;
      remainingCash: number;
      fundingStatus: TierStatus;
      fundingPercent: number;
    }>;
    nextIncomeGoesTo: FundingTier | null;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    excessPending: number | null;
  } {
    const sortedTiers = [...tiers].sort((a, b) => this.TIER_ORDER.indexOf(a.tier) - this.TIER_ORDER.indexOf(b.tier));
    
    const tierSummaries = sortedTiers.map((tier, index) => ({
      tier: tier.tier,
      sortOrder: index + 1,
      targetAmount: tier.targetAmount,
      allocatedAmount: tier.allocatedAmount,
      spentAmount: tier.spentAmount,
      remainingCash: this.getRemainingCash(tier),
      fundingStatus: this.isTierComplete(tier) ? 'complete' : 'in_progress' as TierStatus,
      fundingPercent: this.getFundingPercent(tier),
    }));
    
    return {
      id: projectId,
      name,
      kind,
      contractValue,
      status,
      isActiveCascade,
      tiers: tierSummaries,
      nextIncomeGoesTo: this.getNextIncomeTier(sortedTiers),
      totalAllocated: sumMoney(sortedTiers.map(t => t.allocatedAmount)),
      totalSpent: sumMoney(sortedTiers.map(t => t.spentAmount)),
      totalRemaining: sumMoney(sortedTiers.map(t => this.getRemainingCash(t))),
      excessPending: null, // Set by orchestrator if there's a pending excess prompt
    };
  }

  /**
   * Determines if an excess prompt should be created.
   * Returns true if there's excess amount after allocation and all tiers are complete.
   */
  shouldCreateExcessPrompt(allocationResult: AllocationResult): boolean {
    return allocationResult.excessAmount > 0 && allocationResult.allTiersComplete;
  }

  /**
   * Validates excess prompt target choice.
   */
  validateExcessTarget(target: string): boolean {
    return ['needs', 'wants', 'savings', 'keep'].includes(target);
  }

  /**
   * Calculates the effective target tier for excess resolution.
   * 'keep' means the excess stays as unallocated (future income buffer).
   */
  resolveExcessTarget(target: string): FundingTier | 'savings' | 'keep' {
    switch (target) {
      case 'needs':
      case 'wants':
        return target as FundingTier;
      case 'savings':
        return 'savings';
      case 'keep':
        return 'keep';
      default:
        throw new Error(`Invalid excess target: ${target}`);
    }
  }
}