import React, { useCallback, useState } from 'react';
import {
 View,
 Text,
 ScrollView,
 Pressable,
 RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow, borderWidth } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { msmeProjectsApi } from '@/services/api';
import { ScreenContainer, LoadingState, ErrorState, Button, Toggle } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { formatMoney } from '@/utils/money';
import { safeGoBack } from '@/utils/navigation';
import { ProjectExcessSheet } from '@/components/msme/ProjectExcessSheet';
import { ProjectCompleteSheet } from '@/components/msme/ProjectCompleteSheet';
import {
 ArrowLeft,
 Wallet,
 TrendingUp,
 TrendingDown,
 ArrowLeftRight,
 ShoppingCart,
 CircleDollarSign,
 Plus,
 Power,
 Check,
 X,
 ChevronRight,
 AlertTriangle,
 Circle,
 CircleDot,
} from 'lucide-react-native';
import { useDataSync } from '@/services/data-sync';

// ─── Types ─────────────────────────────────────────────────────────────────
type FundingTier = 'priorities' | 'needs' | 'wants';

interface TierSummary {
 id: string;
 tier: FundingTier;
 sortOrder: number;
 targetAmount: number;
 allocatedAmount: number;
 spentAmount: number;
 remainingCash: number;
 fundingStatus: 'in_progress' | 'complete';
 fundingPercent: number;
 subPockets?: Array<{
   id: string;
   name: string;
   targetAmount: number;
   allocatedAmount: number;
   spentAmount: number;
   remainingCash: number;
   fundingPercent: number;
 }>;
}

interface ProjectSummary {
 id: string;
 name: string;
 kind: string;
 contractValue: number;
 status: 'draft' | 'active' | 'completed' | 'cancelled';
 isActiveCascade: boolean;
 spendingControls?: { lockWantsUntilPrioritiesAndNeedsFunded: boolean; warnOnLowPrioritySpend: boolean };
 completionResolvedAt?: string | null;
 completionResolvedTo?: 'savings' | 'keep' | null;
 tiers: TierSummary[];
 nextIncomeGoesTo: FundingTier | null;
 totalAllocated: number;
 totalSpent: number;
 totalRemaining: number;
 excessPending: number | null;
}

interface TxItem {
 id: string;
 type: 'allocation' | 'spend';
 amount: number;
 tier: FundingTier;
 date: string;
 source?: string;
 merchant?: string | null;
 category?: string | null;
 note?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function tierLabel(tier: FundingTier): string {
 if (tier === 'priorities') return 'Priorities';
 if (tier === 'needs') return 'Needs';
 return 'Wants';
}

function tierColor(tier: FundingTier, colors: any): string {
 if (tier === 'priorities') return colors.emeraldDeep;
 if (tier === 'needs') return colors.gold;
 return colors.clay; // Wants — clay for optional tier
}

function statusBadgeConfig(status: string, colors: any) {
 const map: Record<string, { bg: string; text: string; Icon: React.ComponentType<any> }> = {
 active: { bg: colors.emeraldTint, text: colors.emeraldDeep, Icon: CircleDot },
 draft: { bg: colors.goldTint, text: colors.gold, Icon: Circle },
 completed: { bg: colors.plumTint, text: colors.plum, Icon: Check },
 cancelled: { bg: colors.clayTint, text: colors.clay, Icon: X },
 };
 return map[status] ?? { bg: colors.lineSoft, text: colors.sage, Icon: Circle };
}

function fmtDate(iso: string): string {
 const d = new Date(iso);
 const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
 const date = d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
 return `${date}, ${time}`;
}

// ─── Tier Card ─────────────────────────────────────────────────────────────
function TierCard({
 tier,
 isNext,
 colors,
}: {
 tier: TierSummary;
 isNext: boolean;
 colors: any;
}) {
  const c = tierColor(tier.tier, colors);
  const isComplete = tier.fundingStatus === 'complete';
  const safeFundingPercent = Number.isFinite(tier.fundingPercent) ? tier.fundingPercent : 0;
  const barWidth = Math.min(100, Math.max(0, safeFundingPercent));

  return (
  <View
  style={{
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: isNext ? colors.lineSoft : colors.line,
  padding: spacing.xl,
  marginBottom: spacing.lg,
  overflow: 'hidden',
  }}
  >
  {/* tier identity = dot + label color, not a vertical rail — per stitch taste: whisper border, no neon stripe */}

  {/* Header row — clean, no generic pill borders or dot icons */}
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.lg }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' }}>
  <Text style={{ ...typography.eyebrow, color: c, letterSpacing: 0.6 }}>{tierLabel(tier.tier).toUpperCase()}</Text>
  {isNext && (
  <View style={{ backgroundColor: c === colors.emeraldDeep ? colors.emeraldTint : c === colors.gold ? colors.goldTint : colors.plumTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, minHeight: 22, justifyContent: 'center' }}>
  <Text style={{ ...typography.caption, fontSize: 10, color: c, lineHeight: 12, fontWeight: '700' }}>Next payment goes here</Text>
  </View>
  )}
  </View>
  <View
  style={{
  backgroundColor: isComplete ? colors.emeraldTint : colors.lineSoft,
  borderRadius: radius.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: 4,
  minHeight: 22,
  justifyContent: 'center',
  }}
  >
  <Text style={{ ...typography.caption, fontSize: 10, color: isComplete ? colors.emeraldDeep : colors.sage, lineHeight: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>
  {isComplete ? 'Complete' : 'In Progress'}
  </Text>
  </View>
  </View>

  {/* Funding section — more air, editorial leading */}
  <View style={{ marginBottom: spacing.lg }}>
  <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm, letterSpacing: 0.4 }}>FUNDING</Text>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
  <Text style={{ ...typography.caption, color: colors.sage }}>Target</Text>
  <Text style={{ ...typography.caption, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(tier.targetAmount)}</Text>
  </View>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
  <Text style={{ ...typography.caption, color: colors.sage }}>Allocated</Text>
  <Text style={{ ...typography.heading, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatMoney(tier.allocatedAmount)}</Text>
  </View>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
  <Text style={{ ...typography.caption, color: colors.sage }}>Progress</Text>
  <Text style={{ ...typography.caption, color: isComplete ? colors.emeraldDeep : colors.ink, fontVariant: ['tabular-nums'] }}>
  {safeFundingPercent.toFixed(safeFundingPercent % 1 === 0 ? 0 : 1)}%
  </Text>
  </View>

  {/* visual bar — taller, more breathing */}
  <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
  <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: c, borderRadius: radius.pill }} />
  </View>
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs, textAlign: 'right' }}>
  {formatMoney(tier.allocatedAmount)} / {formatMoney(tier.targetAmount)} · {Math.round(safeFundingPercent)}% · Status: {isComplete ? 'Complete' : 'In Progress'}
  </Text>
  </View>

  {/* divider — hairline, more vertical air */}
  <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: spacing.lg }} />

  {/* Spending section */}
  <View>
  <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm, letterSpacing: 0.4 }}>SPENDING</Text>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
  <Text style={{ ...typography.caption, color: colors.sage }}>Spent</Text>
  <Text style={{ ...typography.caption, color: colors.clay, fontVariant: ['tabular-nums'] }}>{formatMoney(tier.spentAmount)}</Text>
  </View>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
  <Text style={{ ...typography.caption, color: colors.sage }}>Cash Left</Text>
  <Text style={{ ...typography.heading, color: colors.emeraldDeep, fontVariant: ['tabular-nums'] }}>{formatMoney(tier.remainingCash)}</Text>
  </View>
  {isComplete && tier.remainingCash === 0 && tier.spentAmount > 0 && (
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage, marginTop: spacing.xs }}>
  Funding stays Complete even when Cash Left is 0 — spending never reopens the target.
  </Text>
  )}
  </View>

  {/* Sub-pockets section */}
  {tier.subPockets && tier.subPockets.length > 0 && (
    <>
      <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: spacing.lg }} />
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.4 }}>
            SUB-POCKETS ({tier.subPockets.length})
          </Text>
          <Text style={{ ...typography.caption, color: colors.sage, fontSize: 10 }}>
            Proportional Allocation
          </Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          {tier.subPockets.map(sp => {
            const safeSpPercent = Number.isFinite(sp.fundingPercent) ? sp.fundingPercent : 0;
            const spBarWidth = Math.min(100, Math.max(0, safeSpPercent));
            return (
              <View
                key={sp.id}
                style={{
                  backgroundColor: colors.surfaceHover || colors.paper,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.lineSoft,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={{ ...typography.body, fontWeight: '600', color: colors.ink }}>
                    {sp.name}
                  </Text>
                  <Text style={{ ...typography.caption, color: c, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                    {safeSpPercent.toFixed(safeSpPercent % 1 === 0 ? 0 : 1)}%
                  </Text>
                </View>

                <View style={{ height: 5, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden', marginVertical: spacing.xs }}>
                  <View style={{ height: '100%', width: `${spBarWidth}%`, backgroundColor: c, borderRadius: radius.pill }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>
                    Alloc: {formatMoney(sp.allocatedAmount)} / {formatMoney(sp.targetAmount)}
                  </Text>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.emeraldDeep, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                    Cash: {formatMoney(sp.remainingCash)}
                  </Text>
                </View>
                {sp.spentAmount > 0 && (
                  <Text style={{ ...typography.caption, fontSize: 10, color: colors.clay, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    Spent: {formatMoney(sp.spentAmount)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </>
  )}
  </View>
  );
}

// ─── Transaction row ───────────────────────────────────────────────────────
function TxRow({ tx, colors }: { tx: TxItem; colors: any }) {
 const isAllocation = tx.type === 'allocation';
 const Icon = isAllocation ? CircleDollarSign : ShoppingCart;
 const bg = isAllocation ? colors.emeraldTint : colors.clayTint;
 const iconColor = isAllocation ? colors.emeraldDeep : colors.clay;
 const label = isAllocation
 ? `Allocation to ${tierLabel(tx.tier)}`
 : tx.merchant || tierLabel(tx.tier);
 const sub = isAllocation
 ? tierLabel(tx.tier) + ' · cascade'
 : [tx.merchant, tx.note].filter(Boolean).join(' · ') || tierLabel(tx.tier);

 return (
 <View
 style={{
 flexDirection: 'row',
 alignItems: 'center',
 gap: spacing.md,
 paddingVertical: spacing.md,
 borderBottomWidth: borderWidth,
 borderBottomColor: colors.lineSoft,
 }}
 >
 <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
 <Icon size={16} color={iconColor} strokeWidth={2} />
 </View>
 <View style={{ flex: 1 }}>
 <Text style={{ ...typography.heading, color: colors.ink }} numberOfLines={1}>
 {label}
 </Text>
 <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }} numberOfLines={1}>
 {sub} · {fmtDate(tx.date)}
 </Text>
 </View>
 <Text style={{ ...typography.heading, color: isAllocation ? colors.emeraldDeep : colors.clay, fontVariant: ['tabular-nums'] }}>
 {isAllocation ? '+' : '−'}
 {formatMoney(tx.amount)}
 </Text>
 </View>
 );
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function MsmeProjectDetailScreen() {
 const { colors } = useTheme();
 const router = useRouter();
 const { id } = useLocalSearchParams<{ id: string }>();
 const { alert, confirm, modal } = useAlertModal();

 const [project, setProject] = useState<ProjectSummary | null>(null);
 const [transactions, setTransactions] = useState<TxItem[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [error, setError] = useState<string | null>(null);
 // Phase 5 state
 const [excessPrompts, setExcessPrompts] = useState<any[]>([]);
 const [showExcessSheet, setShowExcessSheet] = useState(false);
 const [showCompleteSheet, setShowCompleteSheet] = useState(false);
 const [completeInfo, setCompleteInfo] = useState<{
   project: ProjectSummary;
   remainingPerTier: Array<{ tier: any; remainingCash: number; targetAmount: number; allocatedAmount: number }>;
   totalRemaining: number;
   suggestion: string;
   requiresResolution: boolean;
 } | null>(null);

 // pagination for transactions
 const [page, setPage] = useState(1);
 const [hasMore, setHasMore] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);

 const loadAll = useCallback(async () => {
 if (!id) return;
 try {
 setError(null);
 const [proj, txPage, prompts] = await Promise.all([
 msmeProjectsApi.getById(id),
 msmeProjectsApi.getTransactions(id, 1, 20).catch(() => ({ data: [], total: 0 })),
 msmeProjectsApi.getPendingExcessPrompts(id).catch(() => []),
 ]);
 setProject(proj);
 setExcessPrompts(prompts as any[]);
 const txList: TxItem[] = (txPage as any)?.data ?? (txPage as any)?.transactions ?? [];
 setTransactions(txList);
 setPage(1);
 const total = (txPage as any)?.total ?? txList.length;
 const totalPages = (txPage as any)?.totalPages ?? (total > 20 ? 2 : 1);
 setHasMore((txPage as any)?.pagination ? ((txPage as any).pagination.page < (txPage as any).pagination.totalPages) : totalPages > 1 && txList.length === 20);
 } catch (e) {
 console.error('Project detail load error:', e);
 setError(e instanceof Error ? e.message : 'Failed to load project');
 }
 }, [id]);

 React.useEffect(() => {
 setIsLoading(true);
 loadAll().finally(() => setIsLoading(false));
 }, [loadAll]);

 useFocusEffect(
 useCallback(() => {
 // refresh when coming back from income-entry / log-spend
 loadAll();
 }, [loadAll]),
 );

 const dataVersion = useDataSync(s => s.version);
 const isFirstVersion = React.useRef(true);
 React.useEffect(() => {
 if (isFirstVersion.current) { isFirstVersion.current = false; return; }
 loadAll();
 }, [dataVersion, loadAll]);

 const onRefresh = async () => {
 setIsRefreshing(true);
 await loadAll();
 setIsRefreshing(false);
 };

 const loadMore = async () => {
 if (!hasMore || loadingMore || !id) return;
 setLoadingMore(true);
 try {
 const next = page + 1;
 const txPage = await msmeProjectsApi.getTransactions(id, next, 20);
 const txList: TxItem[] = (txPage as any)?.data ?? (txPage as any)?.transactions ?? [];
 setTransactions(prev => [...prev, ...txList]);
 setPage(next);
 const totalPages = (txPage as any)?.totalPages ?? 1;
 const pg = (txPage as any)?.pagination ?? null;
 if (pg) setHasMore(next < pg.totalPages);
 else setHasMore(txList.length === 20 && next < totalPages);
 } catch (e) {
 console.error('loadMore project transactions error:', e);
 } finally {
 setLoadingMore(false);
 }
 };

 const handleActivate = async () => {
 if (!project) return;
 try {
 if (project.status === 'draft') {
 await msmeProjectsApi.updateStatus(project.id, 'active');
 }
 await msmeProjectsApi.activateCascade(project.id);
 await loadAll();
 useDataSync.getState().bump();
 await alert('Cascade active', 'This project is now receiving cascade allocations. Next income will flow to ' + (project.nextIncomeGoesTo ?? 'Priorities') + '.');
 } catch (e) {
 await alert('Could not activate', e instanceof Error ? e.message : 'Please try again.');
 }
 };

 const handleDeactivate = async () => {
 if (!project) return;
 const ok = await confirm('Deactivate cascade?', 'New income will no longer auto-allocate to this project until you reactivate it.');
 if (!ok) return;
 try {
 await msmeProjectsApi.deactivateCascade(project.id);
 await loadAll();
 } catch (e) {
 await alert('Could not deactivate', e instanceof Error ? e.message : 'Please try again.');
 }
 };

 const handleComplete = async () => {
 if (!project) return;
 const ok = await confirm('Mark project completed?', 'This will lock the project. Remaining cash stays in tiers until you explicitly move it — the new Phase 5 flow will show you exactly how much is left and ask where it should go.');
 if (!ok) return;
 try {
 // Phase 5: use dedicated complete endpoint which auto-deactivates cascade and returns remaining summary.
 const result: any = await msmeProjectsApi.completeProject(project.id);
 setCompleteInfo(result);
 await loadAll();
 // Show the completion sheet immediately so the user can resolve remaining funds without a second tap.
 if (result?.requiresResolution) setShowCompleteSheet(true);
 else await alert('Project completed', result?.suggestion || 'No remaining funds.');
 } catch (e) {
 await alert('Could not complete', e instanceof Error ? e.message : 'Please try again.');
 }
 };

 const handleSpendingControlToggle = async (key: 'lockWantsUntilPrioritiesAndNeedsFunded' | 'warnOnLowPrioritySpend', value: boolean) => {
 if (!project) return;
 const prev = project.spendingControls;
 // optimistic update
 setProject({ ...project, spendingControls: { ...(prev ?? { lockWantsUntilPrioritiesAndNeedsFunded: false, warnOnLowPrioritySpend: false }), [key]: value } });
 try {
 const updated = await msmeProjectsApi.updateSpendingControls(project.id, { [key]: value });
 setProject(updated);
 } catch (e) {
 // rollback
 setProject(project);
 await alert('Could not update control', e instanceof Error ? e.message : 'Please try again.');
 }
 };

 // ── Derived ────────────────────────────────────────────────────────────────
 if (isLoading) {
 return (
 <ScreenContainer>
 <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
 <Pressable onPress={() => safeGoBack(router, '/msme-projects')} hitSlop={8} style={{ padding: spacing.xs, marginRight: spacing.sm }}>
 <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
 </Pressable>
 <Text style={{ ...typography.title, color: colors.ink }}>Project</Text>
 </View>
  <LoadingState label="Loading project..." variant="project-detail" />
 </ScreenContainer>
 );
 }

 if (!project || error) {
 return (
 <ScreenContainer>
 <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
 <Pressable onPress={() => safeGoBack(router, '/msme-projects')} hitSlop={8} style={{ padding: spacing.xs, marginRight: spacing.sm }}>
 <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
 </Pressable>
 <Text style={{ ...typography.title, color: colors.ink }}>Project</Text>
 </View>
 <ErrorState message={error || "Couldn't load project."} onRetry={onRefresh} />
 {modal}
 </ScreenContainer>
 );
 }

 const overallPct = project.contractValue > 0 ? Math.round((project.totalAllocated / project.contractValue) * 100) : 0;
 const statusCfg = statusBadgeConfig(project.status, colors);

 return (
 <ScreenContainer>
 <ScrollView
 style={{ flex: 1 }}
 contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
 refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />}
 onScrollEndDrag={({ nativeEvent }) => {
 const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
 if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) loadMore();
 }}
 >
 {/* ── Header ── */}
 <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
 <Pressable onPress={() => safeGoBack(router, '/msme-projects')} hitSlop={8} style={{ padding: spacing.xs, marginRight: spacing.sm }}>
 <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
 </Pressable>
 <View style={{ flex: 1 }}>
 <Text style={{ ...typography.title, color: colors.ink }} numberOfLines={1}>
 {project.name}
 </Text>
 <Text style={{ ...typography.caption, color: colors.sage }} numberOfLines={1}>
 {project.kind.charAt(0).toUpperCase() + project.kind.slice(1)} · {formatMoney(project.contractValue)} contract
 </Text>
 </View>
 </View>

 {/* Status row */}
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: statusCfg.bg, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
 <statusCfg.Icon size={10} color={statusCfg.text} strokeWidth={2} />
 <Text style={{ ...typography.caption, fontSize: 10, color: statusCfg.text, textTransform: 'capitalize' }}>{project.status}</Text>
 </View>
 {project.isActiveCascade ? (
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.emeraldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.emeraldDeep + '30' }}>
 <Power size={10} color={colors.emeraldDeep} strokeWidth={2} />
 <Text style={{ ...typography.caption, fontSize: 10, color: colors.emeraldDeep }}>Cascade active</Text>
 </View>
 ) : (
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.lineSoft, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill }}>
 <Power size={10} color={colors.sage} strokeWidth={2} />
 <Text style={{ ...typography.caption, fontSize: 10, color: colors.sage }}>Cascade off</Text>
 </View>
 )}
 {project.excessPending != null && project.excessPending > 0 && (
 <View style={{ backgroundColor: colors.goldTint, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.gold + '30' }}>
 <Text style={{ ...typography.caption, fontSize: 10, color: colors.gold }}>Excess {formatMoney(project.excessPending)}</Text>
 </View>
 )}
 </View>

 {/* ── Phase 5 banners ── */}
 {excessPrompts.length > 0 && (
 <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
 <View style={{ backgroundColor: colors.goldTint, borderWidth: 1, borderColor: colors.gold + '30', borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
 <View style={{ width: 36, height: 36, borderRadius: radius.xs, backgroundColor: colors.gold + '18', alignItems: 'center', justifyContent: 'center' }}>
 <AlertTriangle size={16} color={colors.gold} strokeWidth={2} />
 </View>
 <View style={{ flex: 1 }}>
 <Text style={{ ...typography.heading, color: colors.gold }}>{formatMoney(Number(excessPrompts[0].excess_amount))} excess — direct it?</Text>
 <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>All tiers funded. Choose Needs / Wants / Savings / Keep — excess is never moved silently.</Text>
 </View>
 <Pressable onPress={() => setShowExcessSheet(true)} style={{ backgroundColor: colors.gold, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md }}>
 <Text style={{ ...typography.caption, color: colors.surface }}>Resolve</Text>
 </Pressable>
 </View>
 </View>
 )}
 {project.status === 'completed' && project.totalRemaining > 0 && project.completionResolvedTo == null && (
 <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
 <View style={{ backgroundColor: colors.plumTint, borderWidth: 1, borderColor: colors.plum + '30', borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
 <Check size={16} color={colors.plum} strokeWidth={2} />
 <View style={{ flex: 1 }}>
 <Text style={{ ...typography.heading, color: colors.plum }}>Completed — {formatMoney(project.totalRemaining)} unused</Text>
 <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>Keep in project or move to Savings?</Text>
 </View>
 <Pressable onPress={() => setShowCompleteSheet(true)} style={{ backgroundColor: colors.plum, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md }}>
 <Text style={{ ...typography.caption, color: colors.surface }}>Decide</Text>
 </Pressable>
 </View>
 </View>
 )}
 {project.status === 'completed' && project.completionResolvedTo && (
 <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
 <View style={{ backgroundColor: colors.emeraldTint, borderWidth: 1, borderColor: colors.emeraldDeep + '30', borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
 <Check size={16} color={colors.emeraldDeep} strokeWidth={2} />
 <View style={{ flex: 1 }}>
 <Text style={{ ...typography.heading, color: colors.emeraldDeep }}>Resolved to {project.completionResolvedTo}</Text>
 <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
 {project.completionResolvedTo === 'savings' ? `Moved ${formatMoney(project.totalRemaining)} to Savings · ${project.completionResolvedAt ? new Date(project.completionResolvedAt).toLocaleDateString('en-KE') : ''}` : 'Left in project tiers'}
 </Text>
 </View>
 </View>
 </View>
 )}

 {/* ── Hero card — overall funding (dark, like pocket detail hero) ── */}
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
 <View style={{ backgroundColor: colors.heroBg, borderRadius: radius.sm, padding: spacing.lg, paddingTop: spacing.xl, overflow: 'hidden', ...shadow.elevated }}>
 <View style={{ borderTopWidth: 1.5, borderTopColor: colors.emeraldDeep, borderStyle: 'dashed', position: 'absolute', top: 14, left: 0, right: 0 }} />
 <View style={{ position: 'absolute', top: 0, left: 16, width: 34, height: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: colors.emeraldDeep }} />

 <Text style={{ ...typography.caption, color: colors.heroText + 'AA', marginTop: spacing.sm }}>Total allocated of contract</Text>
 <Text style={{ ...typography.display, fontSize: 34, lineHeight: 42, color: colors.heroText, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}>
 {formatMoney(project.totalAllocated)}
 </Text>
 <Text style={{ ...typography.caption, color: colors.heroText + '88', marginTop: 4 }}>
 of {formatMoney(project.contractValue)} · {overallPct}% funded · {formatMoney(project.totalRemaining)} cash left
 </Text>

 <View style={{ height: 6, backgroundColor: colors.heroText + '22', borderRadius: radius.pill, marginTop: spacing.lg, overflow: 'hidden' }}>
 <View style={{ height: '100%', width: `${overallPct}%`, backgroundColor: colors.emeraldDeep, borderRadius: radius.pill }} />
 </View>

  {/* PROJECT FUNDING — tier labels use theme-aware heroText, bars keep tier hue for progress */}
  <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
  <Text style={{ ...typography.eyebrow, fontSize: 10, color: colors.heroText + '88', letterSpacing: 0.6 }}>PROJECT FUNDING</Text>
  {project.tiers.map(t => {
  const c = tierColor(t.tier as FundingTier, colors);
  const safeTPercent = Number.isFinite(t.fundingPercent) ? t.fundingPercent : 0;
  return (
  <View key={t.tier} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.heroText + 'E6', width: 74, fontWeight: '600', letterSpacing: 0.2 }}>{tierLabel(t.tier as FundingTier)}</Text>
  <View style={{ flex: 1, height: 5, backgroundColor: colors.heroText + '18', borderRadius: radius.pill, overflow: 'hidden' }}>
  <View style={{ height: '100%', width: `${Math.min(100, safeTPercent)}%`, backgroundColor: c, borderRadius: radius.pill }} />
  </View>
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.heroText, width: 36, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{Math.round(safeTPercent)}%</Text>
  </View>
  );
  })}
  </View>

  {project.nextIncomeGoesTo && (
  <View style={{ marginTop: spacing.lg, backgroundColor: colors.heroText + '0A', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.heroText + '14', gap: spacing.xs }}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.heroText, fontWeight: '700', letterSpacing: 0.2 }}>
  Next payment goes to {tierLabel(project.nextIncomeGoesTo as FundingTier)}
  </Text>
  </View>
  <Text style={{ ...typography.caption, fontSize: 11, color: colors.heroText + '99', lineHeight: 14 }}>
  Funding Status: {project.tiers.find(t => t.tier === project.nextIncomeGoesTo)?.fundingStatus === 'complete' ? 'Complete' : 'In Progress'} — income flows forward, completed tiers are not refilled
  </Text>
  </View>
  )}
 {!project.nextIncomeGoesTo && (
 <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, backgroundColor: colors.emeraldDeep + '40', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm - 2, alignSelf: 'flex-start' }}>
 <Check size={12} color={colors.heroText} strokeWidth={2} />
 <Text style={{ ...typography.caption, fontSize: 11, color: colors.heroText }}>All tiers funded</Text>
 </View>
 )}

 <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.xl }}>
 <View>
 <Text style={{ ...typography.caption, color: colors.heroText + '88' }}>Total spent</Text>
 <Text style={{ ...typography.heading, color: colors.heroText, fontVariant: ['tabular-nums'] }}>{formatMoney(project.totalSpent)}</Text>
 </View>
 <View>
 <Text style={{ ...typography.caption, color: colors.heroText + '88' }}>Cash left</Text>
 <Text style={{ ...typography.heading, color: colors.heroText, fontVariant: ['tabular-nums'] }}>{formatMoney(project.totalRemaining)}</Text>
 </View>
 <View>
 <Text style={{ ...typography.caption, color: colors.heroText + '88' }}>Tiers</Text>
 <Text style={{ ...typography.heading, color: colors.heroText }}>{project.tiers.filter(t => t.fundingStatus === 'complete').length}/3 funded</Text>
 </View>
 </View>
 </View>
 </View>

 {/* ── Spending controls ── */}
 {project.status === 'active' && (
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
 <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md }}>
 <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.sm }}>Spending controls</Text>
 <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.md, lineHeight: 16 }}>
 Optional friction. Locking Wants prevents spending from Wants before Priorities & Needs are fully funded.
 </Text>
 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
 <View style={{ flex: 1, marginRight: spacing.md }}>
 <Text style={{ ...typography.heading, color: colors.ink }}>Lock Wants</Text>
 <Text style={{ ...typography.caption, color: colors.sage }}>Until Priorities + Needs funded</Text>
 </View>
 <Toggle
 value={Boolean(project.spendingControls?.lockWantsUntilPrioritiesAndNeedsFunded)}
 onValueChange={(v) => handleSpendingControlToggle('lockWantsUntilPrioritiesAndNeedsFunded', v)}
 />
 </View>
 <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: spacing.xs }} />
 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
 <View style={{ flex: 1, marginRight: spacing.md }}>
 <Text style={{ ...typography.heading, color: colors.ink }}>Warn on early Wants</Text>
 <Text style={{ ...typography.caption, color: colors.sage }}>Show recommendation if Wants used early</Text>
 </View>
 <Toggle
 value={Boolean(project.spendingControls?.warnOnLowPrioritySpend)}
 onValueChange={(v) => handleSpendingControlToggle('warnOnLowPrioritySpend', v)}
 />
 </View>
 </View>
 </View>
 )}

 {/* ── Actions ── */}
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm }}>
 {project.status === 'draft' && (
 <Button
 fullWidth
 leftIcon={<Power size={16} color={colors.surface} strokeWidth={2} />}
 onPress={handleActivate}
 >
 Activate project & cascade
 </Button>
 )}
 {project.status === 'active' && !project.isActiveCascade && (
 <Button
 fullWidth
 leftIcon={<Power size={16} color={colors.surface} strokeWidth={2} />}
 onPress={handleActivate}
 >
 Activate cascade
 </Button>
 )}
 {project.status === 'active' && project.isActiveCascade && (
 <>
 <Button
 fullWidth
 leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />}
 onPress={() => router.push({ pathname: '/msme-projects/income-entry', params: { id: project.id } })}
 >
 Add income (instalment)
 </Button>
 <Button
 fullWidth
 variant="secondary"
 leftIcon={<ShoppingCart size={16} color={colors.ink} strokeWidth={2} />}
 onPress={() => router.push({ pathname: '/msme-projects/log-spend', params: { id: project.id } })}
 >
 Log spend from tier
 </Button>
 <View style={{ flexDirection: 'row', gap: spacing.sm }}>
 <View style={{ flex: 1 }}>
 <Button variant="outline" onPress={handleDeactivate}>
 Deactivate
 </Button>
 </View>
 <View style={{ flex: 1 }}>
 <Button
 variant="secondary"
 style={{ backgroundColor: colors.plumTint, borderColor: colors.plum }}
 onPress={handleComplete}
 >
 Mark completed
 </Button>
 </View>
 </View>
 </>
 )}
 {project.status === 'completed' && (
 <>
 <View style={{ backgroundColor: colors.plumTint, borderRadius: radius.md, borderWidth: 1, borderColor: colors.plum + '30', padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
 <Check size={16} color={colors.plum} strokeWidth={2} />
 <Text style={{ ...typography.caption, color: colors.plum, flex: 1 }}>Project completed · {formatMoney(project.totalRemaining)} cash left across tiers</Text>
 </View>
 {project.totalRemaining > 0 && project.completionResolvedTo == null && (
 <Button fullWidth variant="secondary" onPress={() => setShowCompleteSheet(true)}>
 Resolve remaining — Move to Savings?
 </Button>
 )}
 </>
 )}
 </View>

 {/* ── 3 Tier cards ── */}
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
 <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>Funding tiers — Priorities → Needs → Wants</Text>
 {project.tiers
 .slice()
 .sort((a, b) => a.sortOrder - b.sortOrder)
 .map(t => (
 <TierCard key={t.id} tier={t} isNext={project.nextIncomeGoesTo === t.tier} colors={colors} />
 ))}
 <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, lineHeight: 16 }}>
 Funding Status is target-based: once Allocated ≥ Target it stays Complete even after spending. Remaining Cash = Allocated − Spent. Income never re-fills a completed tier.
 </Text>
 </View>

 {/* ── Transactions ── */}
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
 <Text style={{ ...typography.eyebrow, color: colors.ink }}>Transactions</Text>
 {project.totalAllocated > 0 && (
 <Text style={{ ...typography.caption, color: colors.sage }}>{transactions.length} shown</Text>
 )}
 </View>
 <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: borderWidth, borderColor: colors.line, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
 {transactions.length === 0 ? (
 <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
 <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
 <Wallet size={20} color={colors.emeraldDeep} strokeWidth={2} />
 </View>
 <Text style={{ ...typography.heading, color: colors.sage, textAlign: 'center' }}>No transactions yet</Text>
 <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center', marginTop: spacing.xs }}>
 Income allocations and tier spends will appear here.
 </Text>
 </View>
 ) : (
 <>
 {transactions.map(tx => (
 <TxRow key={`${tx.type}-${tx.id}`} tx={tx} colors={colors} />
 ))}
 {hasMore && (
 <Pressable
 onPress={loadMore}
 disabled={loadingMore}
 style={{ marginTop: spacing.md, paddingVertical: spacing.sm, alignItems: 'center', opacity: loadingMore ? 0.6 : 1 }}
 >
 <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>{loadingMore ? 'Loading...' : 'Load more'}</Text>
 </Pressable>
 )}
 </>
 )}
 </View>
 </View>

 {/* ── Footer hint ── */}
 <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
 <View style={{ backgroundColor: colors.emeraldTint, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
 <CircleDollarSign size={16} color={colors.emeraldDeep} strokeWidth={2} style={{ marginTop: 1 }} />
 <Text style={{ ...typography.caption, color: colors.emeraldDeep, flex: 1, lineHeight: 18 }}>
 Funding flows forward: Priorities → Needs → Wants. Once a tier hits its target it stays Complete — spending reduces Cash Left but never reopens the tier for refill.
 </Text>
 </View>
 </View>
 </ScrollView>
 {modal}
 <ProjectExcessSheet
 visible={showExcessSheet}
 onClose={() => setShowExcessSheet(false)}
 projectId={project.id}
 projectName={project.name}
 prompt={excessPrompts[0] ?? null}
 onSuccess={async () => {
 await loadAll();
 useDataSync.getState().bump();
 }}
 />
 <ProjectCompleteSheet
 visible={showCompleteSheet}
 onClose={() => setShowCompleteSheet(false)}
 projectId={project.id}
 project={project}
 completeInfo={completeInfo ?? (project.totalRemaining > 0 ? { project, remainingPerTier: project.tiers.map(t => ({ tier: t.tier as any, remainingCash: t.remainingCash, targetAmount: t.targetAmount, allocatedAmount: t.allocatedAmount })), totalRemaining: project.totalRemaining, suggestion: `Project completed — ${formatMoney(project.totalRemaining)} unused. Keep or move to Savings?`, requiresResolution: true } : null)}
 onSuccess={async () => {
 await loadAll();
 useDataSync.getState().bump();
 }}
 />
 </ScreenContainer>
 );
}
