import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography, shadow } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { ScreenContainer, LoadingState, ErrorState, Button } from '@/components/ui';
import { useAlertModal } from '@/hooks/useAlertModal';
import { msmeProjectsApi } from '@/services/api';
import { formatMoney } from '@/utils/money';
import { Plus, RefreshCw, ChevronRight, Store, Circle, CircleDot, Check, X, Search } from 'lucide-react-native';

interface ProjectSummary {
  id: string;
  name: string;
  kind: string;
  contractValue: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  isActiveCascade: boolean;
  tiers: Array<{
    id: string;
    tier: 'priorities' | 'needs' | 'wants';
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingPercent: number;
    fundingStatus: 'in_progress' | 'complete';
  }>;
  totalAllocated: number;
  nextIncomeGoesTo: 'priorities' | 'needs' | 'wants' | null;
}

type StatusFilter = 'all' | 'active' | 'draft' | 'completed';

export default function MsmeProjectsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { alert, modal } = useAlertModal();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      setError(null);
      const data = await msmeProjectsApi.getAll();
      setProjects(data);
    } catch (e) {
      console.error('Projects load error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadProjects();
    setIsRefreshing(false);
  };

  const filteredProjects = projects.filter(p => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; Icon: React.ComponentType<any> }> = {
      active: { bg: colors.emeraldTint, text: colors.emeraldDeep, Icon: CircleDot },
      draft: { bg: colors.goldTint, text: colors.gold, Icon: Circle },
      completed: { bg: colors.plumTint, text: colors.plum, Icon: Check },
      cancelled: { bg: colors.clayTint, text: colors.clay, Icon: X },
    };
    return (config as any)[status] || { bg: colors.lineSoft, text: colors.sage, Icon: Circle };
  };

  const getNextIncomeBadge = (tier: 'priorities' | 'needs' | 'wants' | null) => {
    if (!tier) return null;
    const tierColors = {
      priorities: { bg: colors.emeraldTint, text: colors.emeraldDeep, border: colors.emeraldDeep },
      needs: { bg: colors.goldTint, text: colors.gold, border: colors.gold },
      wants: { bg: colors.plumTint, text: colors.plum, border: colors.plum },
    };
    const c = tierColors[tier];
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: c.bg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, minHeight: 24 }}>
        <Text style={{ ...typography.caption, fontSize: 10, color: c.text, lineHeight: 12, fontWeight: '700' }}>Next: {tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
      </View>
    );
  };

  const renderProjectCard = (project: ProjectSummary) => {
    const statusConfig = getStatusBadge(project.status);
    const progressPercent = project.contractValue > 0 ? Math.round((project.totalAllocated / project.contractValue) * 100) : 0;

    return (
      <Pressable
        key={project.id}
        onPress={() => router.push(`/msme-projects/detail?id=${project.id}`)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.xl,
          paddingTop: spacing.xl,
          marginBottom: spacing.xl,
          borderWidth: 1,
          borderColor: colors.lineSoft,
          ...shadow.default,
          opacity: pressed ? 0.94 : 1,
        })}
        accessibilityRole="button"
        accessibilityLabel={`${project.name}, ${project.status}, ${formatMoney(project.totalAllocated)} of ${formatMoney(project.contractValue)} allocated`}
      >
        {/* Header — more air, kind as eyebrow not just caption */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.eyebrow, color: colors.sage, letterSpacing: 0.5, fontSize: 10 }}>{project.kind.toUpperCase()} · {project.status.toUpperCase()}</Text>
            <Text style={{ ...typography.title, color: colors.ink, letterSpacing: -0.18 }} numberOfLines={1}>
              {project.name}
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage, fontVariant: ['tabular-nums'] }}>
              {formatMoney(project.contractValue)} contract
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: statusConfig.bg, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: statusConfig.text + '30', minHeight: 28 }}>
            <statusConfig.Icon size={10} color={statusConfig.text} strokeWidth={2} />
            <Text style={{ ...typography.caption, fontSize: 10, color: statusConfig.text, textTransform: 'capitalize', lineHeight: 12, fontWeight: '700' }}>{project.status}</Text>
          </View>
        </View>

        {/* Overall Progress — taller bar, looser label spacing */}
        <View style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm }}>
            <Text style={{ ...typography.caption, color: colors.sage, letterSpacing: 0.3 }}>Overall Funding</Text>
            <Text style={{ ...typography.caption, color: colors.ink, fontVariant: ['tabular-nums'], fontWeight: '600' }}>
              {formatMoney(project.totalAllocated)} / {formatMoney(project.contractValue)} · {progressPercent}%
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: colors.emeraldDeep, borderRadius: radius.pill }} />
          </View>
        </View>

        {/* Tier Progress Bars — editorial spacing, not cramped 4px */}
        <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
          {project.tiers.map(tier => {
            const tierColors = {
              priorities: { bg: colors.emeraldDeep, label: 'Priorities' },
              needs: { bg: colors.gold, label: 'Needs' },
              wants: { bg: colors.plum, label: 'Wants' },
            };
            const c = tierColors[tier.tier];
            const isComplete = tier.fundingStatus === 'complete';
            return (
              <View key={tier.tier} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ ...typography.caption, fontSize: 11, color: c.bg, fontWeight: '600', letterSpacing: 0.2 }}>{c.label}</Text>
                  <Text style={{ ...typography.caption, fontSize: 11, color: colors.inkSoft, fontVariant: ['tabular-nums'] }}>
                    {formatMoney(tier.allocatedAmount)} / {formatMoney(tier.targetAmount)} · {tier.fundingPercent}%
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.lineSoft, borderRadius: radius.pill, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.min(100, tier.fundingPercent)}%`, backgroundColor: c.bg, borderRadius: radius.pill, opacity: isComplete ? 1 : 0.85 }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Next Income Badge */}
        {getNextIncomeBadge(project.nextIncomeGoesTo)}

        {/* Chevron — quieter, more air above */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ ...typography.caption, fontSize: 11, color: colors.sage }}>Open</Text>
            <ChevronRight size={14} color={colors.sage} strokeWidth={2} />
          </View>
        </View>
      </Pressable>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ ...typography.title, color: colors.ink }}>Projects</Text>
        </View>
        <LoadingState label="Loading projects…" variant="loans" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emeraldDeep} />
        }
      >
        {/* Header */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ ...typography.title, color: colors.ink }}>Projects</Text>
          <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs }}>
            Manage your business project funding cascades
          </Text>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
            <Search size={18} color={colors.sage} strokeWidth={2} />
            <TextInput
              style={{ flex: 1, ...typography.body, color: colors.ink, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}
              placeholder="Search projects..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.sage}
            />
          </View>
        </View>

        {/* Status Filter — pill row with consistent minHeight and spacing */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg, alignItems: 'center' }}>
            {(['all', 'active', 'draft', 'completed'] as StatusFilter[]).map(filter => (
              <Pressable
                key={filter}
                onPress={() => setStatusFilter(filter)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={({ pressed }) => [{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: statusFilter === filter ? colors.emeraldDeep : colors.surface,
                  borderWidth: 1,
                  borderColor: statusFilter === filter ? colors.emeraldDeep : colors.line,
                  minHeight: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                }, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityState={{ selected: statusFilter === filter }}
              >
                <Text style={{ ...typography.caption, color: statusFilter === filter ? colors.surface : colors.ink, textTransform: 'capitalize', lineHeight: 14, fontWeight: statusFilter === filter ? '700' : '400' }}>
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Create Button */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Button
            fullWidth
            leftIcon={<Plus size={16} color={colors.surface} strokeWidth={2} />}
            onPress={() => router.push('/msme-projects/create')}
          >
            Create New Project
          </Button>
        </View>

        {/* Error State */}
        {error && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <ErrorState message={error} onRetry={onRefresh} />
          </View>
        )}

        {/* Projects List */}
        {!error && filteredProjects.length === 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.goldTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
              <Store size={32} color={colors.gold} strokeWidth={2} />
            </View>
            <Text style={{ ...typography.heading, color: colors.sage, marginTop: spacing.md }}>
              No projects yet
            </Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.xs, textAlign: 'center' }}>
              Create your first project to start tracking funding cascades
            </Text>
          </View>
        )}

        {!error && filteredProjects.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            {filteredProjects.map(renderProjectCard)}
          </View>
        )}
      </ScrollView>
      {modal}
    </ScreenContainer>
  );
}