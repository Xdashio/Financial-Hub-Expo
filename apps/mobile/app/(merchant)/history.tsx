import React, { useState, useEffect } from 'react';
import { ScreenContainer, LoadingState } from '@/components/ui';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { merchantReportApi } from '@/services/api';
import {
  ArrowLeft,
  Flag,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';

interface Report {
  id: string;
  recipient_key: string;
  report_type: string;
  description: string | null;
  suggested_category: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  wrong_category: 'Wrong Category',
  not_gambling: 'Not Gambling',
  wrong_amount: 'Wrong Amount',
  unknown_payee: 'Unknown Payee',
};

const STATUS_CONFIG = {
  pending: {
    icon: AlertCircle,
    color: 'gold',
    label: 'Pending Review',
  },
  reviewed: {
    icon: CheckCircle,
    color: 'emerald',
    label: 'Reviewed',
  },
  rejected: {
    icon: XCircle,
    color: 'error',
    label: 'Rejected',
  },
};

export default function ReportHistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, modal } = useAlertModal();

  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  useEffect(() => {
    loadReports();
  }, [pagination.page, statusFilter]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const response = await merchantReportApi.getReports(
        pagination.page,
        pagination.limit,
        statusFilter,
      );
      setReports(response.reports);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading reports:', error);
      alert('Error', 'Failed to load report history');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  const getStatusColor = (status: string) => {
    const config = getStatusConfig(status);
    switch (config.color) {
      case 'emerald':
        return colors.emeraldDeep;
      case 'error':
        return colors.clay;
      case 'gold':
        return colors.gold;
      default:
        return colors.sage;
    }
  };

  const getStatusBgColor = (status: string) => {
    const config = getStatusConfig(status);
    switch (config.color) {
      case 'emerald':
        return colors.emeraldTint;
      case 'error':
        return colors.errorTint;
      case 'gold':
        return colors.goldTint;
      default:
        return colors.lineSoft;
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)')} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Report History
          </Text>
        </View>

        {/* Filter Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Flag size={16} color={colors.sage} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.sm }}>
                {pagination.total} total reports
              </Text>
            </View>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.sm,
                borderRadius: radius.xs,
                backgroundColor: statusFilter ? colors.emeraldTint : colors.surface,
                borderWidth: 1,
                borderColor: statusFilter ? colors.emeraldDeep : colors.line,
              }}
              onPress={() => {
                if (statusFilter) {
                  setStatusFilter(undefined);
                } else {
                  setShowFilterMenu(!showFilterMenu);
                }
              }}
            >
              <Filter size={16} color={statusFilter ? colors.emeraldDeep : colors.sage} strokeWidth={2} />
              <Text
                style={{
                  ...typography.caption,
                  color: statusFilter ? colors.emeraldDeep : colors.sage,
                  marginLeft: spacing.xs,
                }}
              >
                {statusFilter ? `Filtered: ${statusFilter}` : 'Filter'}
              </Text>
            </Pressable>
          </View>

          {showFilterMenu && (
            <View
              style={{
                marginTop: spacing.sm,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              {['pending', 'reviewed', 'rejected'].map((status) => (
                <Pressable
                  key={status}
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.xs,
                    backgroundColor: statusFilter === status ? colors.emeraldDeep : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                  onPress={() => {
                    setStatusFilter(status === statusFilter ? undefined : status);
                    setShowFilterMenu(false);
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: statusFilter === status ? colors.surface : colors.ink,
                    }}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Report List */}
        <ScrollView style={{ flex: 1, marginTop: spacing.lg }}>
          {isLoading ? (
            <LoadingState label="Loading reports..." variant="list" />
          ) : reports.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Flag size={48} color={colors.sage} strokeWidth={1} />
              <Text style={{ ...typography.heading, color: colors.ink, marginTop: spacing.md }}>
                No reports yet
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm, textAlign: 'center' }}>
                {statusFilter
                  ? `No ${statusFilter} reports found`
                  : 'Submit a report when you encounter classification issues'}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {reports.map((report) => {
                const StatusIcon = getStatusConfig(report.status).icon;
                const statusColor = getStatusColor(report.status);
                const statusBgColor = getStatusBgColor(report.status);

                return (
                  <View
                    key={report.id}
                    style={{
                      padding: spacing.lg,
                      borderRadius: radius.md,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                      marginBottom: spacing.md,
                    }}
                  >
                    {/* Header Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radius.md,
                          backgroundColor: colors.goldTint,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Flag size={20} color={colors.gold} strokeWidth={2} />
                      </View>
                      <View style={{ marginLeft: spacing.md, flex: 1 }}>
                        <Text style={{ ...typography.heading, color: colors.ink }}>
                          {report.recipient_key}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                          {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: spacing.sm,
                          borderRadius: radius.xs,
                          backgroundColor: statusBgColor,
                        }}
                      >
                        <StatusIcon size={14} color={statusColor} strokeWidth={2} />
                        <Text
                          style={{
                            ...typography.caption,
                            color: statusColor,
                            marginLeft: spacing.xs,
                          }}
                        >
                          {getStatusConfig(report.status).label}
                        </Text>
                      </View>
                    </View>

                    {/* Description */}
                    {report.description && (
                      <View style={{ marginBottom: spacing.md }}>
                        <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>
                          Details:
                        </Text>
                        <Text style={{ ...typography.body, color: colors.ink }}>{report.description}</Text>
                      </View>
                    )}

                    {/* Suggested Category */}
                    {report.suggested_category && (
                      <View style={{ marginBottom: spacing.md }}>
                        <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.xs }}>
                          Suggested Category:
                        </Text>
                        <Text style={{ ...typography.body, color: colors.ink }}>{report.suggested_category}</Text>
                      </View>
                    )}

                    {/* Timestamps */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Clock size={14} color={colors.sage} strokeWidth={2} />
                      <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.xs }}>
                        Submitted: {formatDate(report.created_at)}
                      </Text>
                    </View>
                    {report.reviewed_at && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                        <CheckCircle size={14} color={colors.emeraldDeep} strokeWidth={2} />
                        <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.xs }}>
                          Reviewed: {formatDate(report.reviewed_at)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }}>
                  <Pressable
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pagination.page > 1 ? colors.surface : colors.lineSoft,
                      marginRight: spacing.sm,
                    }}
                    onPress={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: pagination.page > 1 ? colors.ink : colors.sage,
                      }}
                    >
                      Previous
                    </Text>
                  </Pressable>
                  <Text style={{ ...typography.caption, color: colors.ink, padding: spacing.md }}>
                    Page {pagination.page} of {pagination.totalPages}
                  </Text>
                  <Pressable
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: pagination.page < pagination.totalPages ? colors.surface : colors.lineSoft,
                      marginLeft: spacing.sm,
                    }}
                    onPress={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    <Text
                      style={{
                        ...typography.caption,
                        color: pagination.page < pagination.totalPages ? colors.ink : colors.sage,
                      }}
                    >
                      Next
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
      {modal}
    </ScreenContainer>
  );
}