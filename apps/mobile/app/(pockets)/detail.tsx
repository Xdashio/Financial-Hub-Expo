import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import {
  ArrowLeft,
  Wallet,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  LucideIcon,
} from 'lucide-react-native';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  merchant: string | null;
  category: string | null;
  created_at: string;
}

interface PocketSummary {
  pocket: {
    id: string;
    name: string;
    kind: string;
    category: string | null;
    monthly_allocation: number;
    daily_cap: number | null;
    is_time_locked: boolean;
    lock_until: string | null;
  };
  summary: {
    available: number;
    spent: number;
    remaining: number;
    percentage_remaining: number;
    monthly_allocation: number;
    days_remaining: number;
    daily_average_spend: number;
  };
  recent_activity: {
    last_transaction: string | null;
    transaction_count: number;
    reallocation_count: number;
  };
}

export default function PocketDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [pocketSummary, setPocketSummary] = useState<PocketSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (id) {
      loadPocketData();
    }
  }, [id]);

  const loadPocketData = async () => {
    try {
      setIsLoading(true);
      const [summary, txPage] = await Promise.all([
        pocketsApi.getSummary(id),
        pocketsApi.getTransactions(id, 1, 20),
      ]);
      setPocketSummary(summary);
      setTransactions(txPage.transactions);
      setPage(1);
      setHasMore(txPage.pagination.page < txPage.pagination.totalPages);
    } catch (error) {
      console.error('Error loading pocket data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadPocketData();
    setIsRefreshing(false);
  };

  const loadMoreTransactions = async () => {
    if (!hasMore || isRefreshing) return;

    try {
      setIsRefreshing(true);
      const nextPage = page + 1;
      const txPage = await pocketsApi.getTransactions(id, nextPage, 20);
      setTransactions([...transactions, ...txPage.transactions]);
      setPage(nextPage);
      setHasMore(txPage.pagination.page < txPage.pagination.totalPages);
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddMoney = () => {
    // Navigate to reallocation flow with destination pre-set
    router.push({
      pathname: '/(modals)/realloc-pick',
      params: { destinationPocketId: id },
    });
  };

  const handleReallocate = () => {
    router.push('/(modals)/realloc-pick');
  };

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type: string): LucideIcon => {
    switch (type) {
      case 'spend':
        return TrendingDown;
      case 'allocation':
        return TrendingUp;
      case 'reallocation_in':
        return Plus;
      case 'reallocation_out':
        return RefreshCw;
      default:
        return Wallet;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'spend':
        return colors.clay;
      case 'allocation':
        return colors.emeraldDeep;
      case 'reallocation_in':
        return colors.gold;
      case 'reallocation_out':
        return colors.sage;
      default:
        return colors.ink;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.emeraldDeep} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />
        }
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Pocket Details
          </Text>
        </View>

        {pocketSummary && (
          <>
            {/* Pocket Header */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.emeraldTint, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Wallet size={24} color={colors.emeraldDeep} strokeWidth={2} />
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={{ ...typography.title, color: colors.ink, fontSize: 18 }}>
                    {pocketSummary.pocket.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                    {pocketSummary.pocket.kind} • {pocketSummary.pocket.category}
                  </Text>
                </View>
                {pocketSummary.pocket.is_time_locked && (
                  <View style={{ 
                    paddingHorizontal: spacing.sm, 
                    paddingVertical: spacing.xs, 
                    borderRadius: radius.pill, 
                    backgroundColor: colors.goldTint 
                  }}>
                    <Text style={{ ...typography.caption, fontSize: 10, color: colors.gold }}>
                      Time-locked
                    </Text>
                  </View>
                )}
              </View>

              {/* Summary Cards */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <View style={{ 
                  flex: 1, 
                  padding: spacing.md, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.surface, 
                  borderWidth: 1, 
                  borderColor: colors.line 
                }}>
                  <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>
                    Available
                  </Text>
                  <Text style={{ ...typography.title, color: colors.emeraldDeep, fontSize: 24 }}>
                    {formatCurrency(pocketSummary.summary.available)}
                  </Text>
                </View>
                <View style={{ 
                  flex: 1, 
                  padding: spacing.md, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.surface, 
                  borderWidth: 1, 
                  borderColor: colors.line 
                }}>
                  <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>
                    Spent
                  </Text>
                  <Text style={{ ...typography.title, color: colors.clay, fontSize: 24 }}>
                    {formatCurrency(pocketSummary.summary.spent)}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={{ marginTop: spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {pocketSummary.summary.percentage_remaining}% remaining
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    {pocketSummary.summary.days_remaining} days left
                  </Text>
                </View>
                <View style={{ 
                  height: 8, 
                  backgroundColor: colors.lineSoft, 
                  borderRadius: radius.pill, 
                  overflow: 'hidden' 
                }}>
                  <View style={{ 
                    height: '100%', 
                    width: `${pocketSummary.summary.percentage_remaining}%`, 
                    backgroundColor: colors.emeraldDeep 
                  }} />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <Pressable 
                  style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: spacing.md, 
                    borderRadius: radius.md, 
                    backgroundColor: colors.emeraldDeep 
                  }}
                  onPress={handleAddMoney}
                >
                  <Plus size={20} color={colors.surface} strokeWidth={2} />
                  <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                    Add Money
                  </Text>
                </Pressable>
                <Pressable 
                  style={{ 
                    flex: 1, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: spacing.md, 
                    borderRadius: radius.md, 
                    backgroundColor: colors.surface, 
                    borderWidth: 1, 
                    borderColor: colors.line 
                  }}
                  onPress={handleReallocate}
                >
                  <RefreshCw size={20} color={colors.ink} strokeWidth={2} />
                  <Text style={{ ...typography.heading, color: colors.ink, marginLeft: spacing.sm }}>
                    Reallocate
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
                Recent Activity
              </Text>
              <View style={{ 
                flexDirection: 'row', 
                gap: spacing.lg, 
                padding: spacing.md, 
                borderRadius: radius.md, 
                backgroundColor: colors.surface, 
                borderWidth: 1, 
                borderColor: colors.line 
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    Transactions
                  </Text>
                  <Text style={{ ...typography.title, color: colors.ink, fontSize: 20 }}>
                    {pocketSummary.recent_activity.transaction_count}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.caption, color: colors.sage }}>
                    Reallocations
                  </Text>
                  <Text style={{ ...typography.title, color: colors.ink, fontSize: 20 }}>
                    {pocketSummary.recent_activity.reallocation_count}
                  </Text>
                </View>
              </View>
            </View>

            {/* Transaction History */}
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
                Transaction History
              </Text>
              {transactions.length === 0 ? (
                <View style={{ 
                  padding: spacing.xl, 
                  borderRadius: radius.md, 
                  backgroundColor: colors.surface, 
                  borderWidth: 1, 
                  borderColor: colors.line,
                  alignItems: 'center'
                }}>
                  <Wallet size={32} color={colors.sage} strokeWidth={2} />
                  <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>
                    No transactions yet
                  </Text>
                </View>
              ) : (
                transactions.map((transaction) => {
                  const TransactionIcon = getTransactionIcon(transaction.type);
                  return (
                    <View 
                      key={transaction.id} 
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        padding: spacing.md, 
                        borderRadius: radius.md, 
                        backgroundColor: colors.surface, 
                        marginBottom: spacing.sm 
                      }}
                    >
                      <View style={{ 
                        width: 36, 
                        height: 36, 
                        borderRadius: radius.xs, 
                        backgroundColor: getTransactionColor(transaction.type) + '20', 
                        alignItems: 'center', 
                        justifyContent: 'center' 
                      }}>
                        <TransactionIcon size={18} color={getTransactionColor(transaction.type)} strokeWidth={2} />
                      </View>
                      <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={{ ...typography.heading, color: colors.ink }}>
                          {transaction.merchant || transaction.type}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                          {formatDateTime(transaction.created_at)}
                        </Text>
                      </View>
                      <Text style={{ 
                        ...typography.heading, 
                        color: transaction.type === 'spend' ? colors.clay : colors.emeraldDeep 
                      }}>
                        {transaction.type === 'spend' ? '-' : '+'}{formatCurrency(transaction.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}