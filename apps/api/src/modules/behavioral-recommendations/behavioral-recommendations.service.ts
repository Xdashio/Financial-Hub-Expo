import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import type { FixedExpense } from '../../database/database.types';
import { round2 } from '@financial-hub/shared';

export interface AllocationRecommendation {
  expenseId: string;
  name: string;
  currentAllocation: number;
  recommendedAllocation: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  basedOnCycles: number;
}

@Injectable()
export class BehavioralRecommendationsService {
  constructor(private readonly repository: SupabaseRepository) {}

  /**
   * Generate allocation recommendations for a user based on historical
   * planning cycle events and actual spending.
   */
  async generateRecommendations(userId: string): Promise<AllocationRecommendation[]> {
    // Get planning cycle events for the last 6 months
    const cycleEvents = await this.repository.getPlanningCycleEventsByUserId(userId, 6);
    
    // Get current fixed expenses — individual segment only (016 isolation)
    const fixedExpenses = await this.repository.getFixedExpensesByUserId(userId, 'individual');
    const activeExpenses = fixedExpenses.filter(f => f.status === 'active');

    if (cycleEvents.length < 2) {
      // Need at least 2 cycles for meaningful recommendations
      return [];
    }

    const recommendations: AllocationRecommendation[] = [];

    for (const expense of activeExpenses) {
      const recommendation = this.analyzeExpenseHistory(
        expense,
        cycleEvents,
      );
      
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Analyze a single expense's history across planning cycles.
   */
  private analyzeExpenseHistory(
    expense: FixedExpense,
    cycleEvents: any[],
  ): AllocationRecommendation | null {
    const expenseHistory = cycleEvents
      .map(event => {
        const allocation = event.allocation_snapshot?.find(
          (a: any) => a.expenseId === expense.id || a.name === expense.name
        );
        if (!allocation) return null;
        
        return {
          cycleMonth: event.cycle_month,
          allocated: allocation.fundedAmount || allocation.amount,
          actualSpend: 0, // Would need transaction data
          carryForward: allocation.carryForwardAmount || 0,
        };
      })
      .filter((h): h is { cycleMonth: string; allocated: number; actualSpend: number; carryForward: number } => h !== null);

    if (expenseHistory.length < 2) {
      return null;
    }

    // Calculate average actual spend (simplified - would use real transaction data)
    // For now, use the allocated amount minus carry-forward as proxy for actual
    const avgAllocated = expenseHistory.reduce(
      (sum, h) => sum + (h.allocated - h.carryForward), 
      0
    ) / expenseHistory.length;

    const currentAllocation = expense.amount;
    const recommendedAllocation = round2(avgAllocated * 1.1); // 10% buffer

    // Determine confidence based on number of cycles and variance
    const confidence = this.calculateConfidence(expenseHistory);

    // Only recommend if difference is significant (>10%)
    const difference = Math.abs(recommendedAllocation - currentAllocation);
    const percentDiff = difference / currentAllocation;
    
    if (percentDiff < 0.1) {
      return null;
    }

    let reason = '';
    if (recommendedAllocation > currentAllocation) {
      reason = `Your ${expense.name.toLowerCase()} has averaged KSh ${avgAllocated.toFixed(0)} over ${expenseHistory.length} cycles. Consider increasing allocation to KSh ${recommendedAllocation.toFixed(0)}.`;
    } else {
      reason = `Your ${expense.name.toLowerCase()} has averaged KSh ${avgAllocated.toFixed(0)} over ${expenseHistory.length} cycles, below your current KSh ${currentAllocation.toFixed(0)} allocation. Consider reducing to KSh ${recommendedAllocation.toFixed(0)}.`;
    }

    return {
      expenseId: expense.id,
      name: expense.name,
      currentAllocation,
      recommendedAllocation,
      confidence,
      reason,
      basedOnCycles: expenseHistory.length,
    };
  }

  /**
   * Calculate confidence level based on historical data quality.
   */
  private calculateConfidence(
    history: { allocated: number; carryForward: number }[],
  ): 'low' | 'medium' | 'high' {
    if (history.length >= 5) return 'high';
    if (history.length >= 3) return 'medium';
    return 'low';
  }

  /**
   * Apply a user's accepted recommendation to update the fixed expense allocation.
   */
  async applyRecommendation(
    userId: string,
    expenseId: string,
    newAllocation: number,
  ): Promise<void> {
    // Verify the expense belongs to the user
    const expense = await this.repository.getFixedExpenseById(expenseId);
    if (!expense || expense.user_id !== userId) {
      throw new Error('Expense not found');
    }

    // Update the fixed expense amount
    await this.repository.updateFixedExpense(expenseId, {
      amount: newAllocation,
    });
  }

  /**
   * Get the user's recommendation history (accepted/rejected recommendations).
   * Queries behavior events related to recommendation decisions.
   */
  async getRecommendationHistory(userId: string): Promise<AllocationRecommendation[]> {
    // Get behavior events related to recommendations
    const behaviorEvents = await this.repository.getBehaviorEventsByUserId(userId);
    
    // Filter events that are related to recommendation decisions
    const recommendationEvents = behaviorEvents.filter(
      (event) => event.type === 'recommendation_accepted' || event.type === 'recommendation_rejected'
    );
    
    // Build recommendation history from events
    const history: AllocationRecommendation[] = recommendationEvents.map((event) => {
      const payload = event.payload as {
        expenseId: string;
        name: string;
        newAllocation: number;
        decision: 'accepted' | 'rejected';
      };
      
      if (payload.decision === 'accepted') {
        return {
          expenseId: payload.expenseId,
          name: payload.name,
          currentAllocation: 0,
          recommendedAllocation: payload.newAllocation,
          confidence: 'medium',
          reason: 'Accepted user recommendation',
          basedOnCycles: 0,
        };
      } else {
        return {
          expenseId: payload.expenseId,
          name: payload.name,
          currentAllocation: 0,
          recommendedAllocation: 0,
          confidence: 'low',
          reason: 'Rejected user recommendation',
          basedOnCycles: 0,
        };
      }
    });
    
    return history;
  }
}