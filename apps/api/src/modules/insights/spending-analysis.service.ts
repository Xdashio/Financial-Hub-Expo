import { Injectable, BadRequestException } from '@nestjs/common';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { Transaction, Pocket } from '../../database/database.types';

const MINIMUM_HISTORY_DAYS = 7;
const ANALYSIS_WINDOW_DAYS = 30;

interface DailySpendAnalysis {
  least_daily_spend: number;
  most_daily_spend: number;
  average_daily_spend: number;
  days_of_history: number;
  daily_spend_by_date: Map<string, number>;
}

@Injectable()
export class SpendingAnalysisService {
  constructor(private readonly repository: SupabaseRepository) {}

  /**
   * Analyzes 30-day spending patterns for emergency unlock recommendations.
   * Filters to non-savings + fixed expenses pockets only.
   */
  async analyze30DaySpending(userId: string, planId: string): Promise<DailySpendAnalysis> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ANALYSIS_WINDOW_DAYS);

    // Get all transactions in the 30-day window
    const transactions = await this.repository.getTransactionsByDateRange(
      userId,
      thirtyDaysAgo.toISOString(),
      new Date().toISOString(),
    );

    // Get pockets to filter out savings
    const pockets = await this.repository.getTopLevelPocketsByPlanId(planId);
    const nonSavingsPocketIds = this.getNonSavingsPocketIds(pockets);

    // Filter transactions to non-savings pockets and spend type only
    const filteredTransactions = this.filterToNonSavingsPockets(
      transactions,
      nonSavingsPocketIds,
    );

    // Group by date and calculate daily totals
    const dailySpendMap = this.groupByDate(filteredTransactions);

    // Calculate statistics
    const stats = this.calculateStatistics(dailySpendMap);

    return {
      ...stats,
      daily_spend_by_date: dailySpendMap,
    };
  }

  /**
   * Checks if user has enough spending history for meaningful analysis.
   */
  hasSufficientHistory(analysis: DailySpendAnalysis): boolean {
    return analysis.days_of_history >= MINIMUM_HISTORY_DAYS;
  }

  /**
   * Get pocket IDs that are NOT savings (spendable + fixed expenses)
   */
  private getNonSavingsPocketIds(pockets: Pocket[]): string[] {
    return pockets
      .filter((p) => p.kind !== 'savings')
      .map((p) => p.id);
  }

  /**
   * Filter transactions to exclude savings pocket and non-spend types.
   * Only 'spend' transactions count toward daily spending analysis.
   * Excludes refunds (negative amounts).
   */
  private filterToNonSavingsPockets(
    transactions: Transaction[],
    nonSavingsPocketIds: string[],
  ): Transaction[] {
    return transactions.filter((t) => {
      // Only spend transactions (not allocations, reallocations, etc.)
      if (t.type !== 'spend') return false;
      
      // Only from non-savings pockets
      if (!nonSavingsPocketIds.includes(t.pocket_id)) return false;
      
      // Exclude refunds (negative amounts)
      if (t.amount < 0) return false;
      
      return true;
    });
  }

  /**
   * Group transactions by date and sum amounts per day.
   */
  private groupByDate(transactions: Transaction[]): Map<string, number> {
    const dailyMap = new Map<string, number>();

    for (const txn of transactions) {
      const date = txn.created_at.split('T')[0]; // Extract YYYY-MM-DD
      const currentTotal = dailyMap.get(date) || 0;
      dailyMap.set(date, currentTotal + txn.amount);
    }

    return dailyMap;
  }

  /**
   * Calculate least, most, and average daily spend from the daily map.
   * Handles edge case where all values are equal.
   */
  private calculateStatistics(dailySpendMap: Map<string, number>): Omit<
    DailySpendAnalysis,
    'daily_spend_by_date'
  > {
    const dailyAmounts = Array.from(dailySpendMap.values());

    if (dailyAmounts.length === 0) {
      return {
        least_daily_spend: 0,
        most_daily_spend: 0,
        average_daily_spend: 0,
        days_of_history: 0,
      };
    }

    const least = Math.min(...dailyAmounts);
    const most = Math.max(...dailyAmounts);
    const average = dailyAmounts.reduce((sum, val) => sum + val, 0) / dailyAmounts.length;

    return {
      least_daily_spend: least,
      most_daily_spend: most,
      average_daily_spend: average,
      days_of_history: dailyAmounts.length,
    };
  }

  /**
   * Calculate how many days a given amount will last based on least daily spend.
   * Uses the more conservative option (least_daily_spend) as specified.
   */
  calculateDaysLasting(amount: number, leastDailySpend: number): number {
    if (leastDailySpend <= 0) {
      throw new BadRequestException('Invalid daily spend value for calculation');
    }
    return Math.floor(amount / leastDailySpend);
  }
}
