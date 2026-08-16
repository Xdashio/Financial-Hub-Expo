import React, { useState, useEffect } from 'react';
import { ScreenContainer } from '@/components/ui';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { merchantApi } from '@/services/api';
import {
  ArrowLeft,
  Search,
  Trash2,
  Tag,
  Clock,
  Shield,
  ShieldCheck,
} from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';
import { formatMoney } from '@/utils/money';

interface Classification {
  id: string;
  recipient_key: string;
  category: string;
  pocket_id: string | null;
  pocket_name: string;
  remember: boolean;
  usage_count: number;
  last_used: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ClassificationHistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { alert, confirm, modal } = useAlertModal();

  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadClassifications();
  }, [pagination.page, searchQuery]);

  const loadClassifications = async () => {
    try {
      setIsLoading(true);
      const response = await merchantApi.getClassifications(
        pagination.page,
        pagination.limit,
        searchQuery || undefined,
      );
      setClassifications(response.classifications);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading classifications:', error);
      alert('Error', 'Failed to load classification history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (classification: Classification) => {
    const confirmed = await confirm(
      'Delete Classification',
      `Are you sure you want to delete the classification for "${classification.recipient_key}"? Future payments from this merchant will not be auto-sorted.`
    );

    if (confirmed) {
      try {
        setDeletingId(classification.id);
        await merchantApi.deleteClassification(classification.id);
        
        // Refresh the list
        await loadClassifications();
        
        await alert('Success', 'Classification deleted successfully');
      } catch (error) {
        console.error('Error deleting classification:', error);
        await alert('Error', 'Failed to delete classification');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryIcon = (category: string) => {
    // Simple mapping based on common categories
    const iconMap: Record<string, string> = {
      grocery: '🛒',
      landlord_rent: '🏠',
      utility: '💡',
      transport: '🚗',
      healthcare: '🏥',
      education: '📚',
      entertainment: '🎬',
      personal_care: '💅',
      other: '📦',
    };
    return iconMap[category] || '📦';
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
            Classification History
          </Text>
        </View>

        {/* Search Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Search size={20} color={colors.sage} strokeWidth={2} />
            <TextInput
              style={{
                ...typography.body,
                color: colors.ink,
                marginLeft: spacing.sm,
                flex: 1,
              }}
              placeholder="Search by merchant name..."
              placeholderTextColor={colors.sage}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Stats Bar */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldTint,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Tag size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginLeft: spacing.sm }}>
                {pagination.total} total classifications
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ShieldCheck size={16} color={colors.emeraldDeep} strokeWidth={2} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, marginLeft: spacing.sm }}>
                {classifications.filter(c => c.remember).length} remembered
              </Text>
            </View>
          </View>
        </View>

        {/* Classification List */}
        <ScrollView style={{ flex: 1, marginTop: spacing.lg }}>
          {isLoading ? (
            <View style={{ padding: spacing.xl }}>
              <Text style={{ ...typography.caption, color: colors.sage, textAlign: 'center' }}>
                Loading classifications...
              </Text>
            </View>
          ) : classifications.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Tag size={48} color={colors.sage} strokeWidth={1} />
              <Text style={{ ...typography.heading, color: colors.ink, marginTop: spacing.md }}>
                No classifications yet
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: spacing.sm, textAlign: 'center' }}>
                {searchQuery ? 'No matching classifications found' : 'Start classifying payments to build your history'}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {classifications.map((classification) => (
                <View
                  key={classification.id}
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
                      <Text style={{ fontSize: 20 }}>{getCategoryIcon(classification.category)}</Text>
                    </View>
                    <View style={{ marginLeft: spacing.md, flex: 1 }}>
                      <Text style={{ ...typography.heading, color: colors.ink }}>
                        {classification.recipient_key}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                        {classification.pocket_name}
                      </Text>
                    </View>
                    {classification.remember ? (
                      <Shield size={20} color={colors.emeraldDeep} strokeWidth={2} />
                    ) : (
                      <Shield size={20} color={colors.sage} strokeWidth={2} />
                    )}
                  </View>

                  {/* Details Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.lg }}>
                      <Clock size={14} color={colors.sage} strokeWidth={2} />
                      <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.xs }}>
                        Last used: {formatDate(classification.last_used)}
                      </Text>
                    </View>
                    {classification.usage_count > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Tag size={14} color={colors.sage} strokeWidth={2} />
                        <Text style={{ ...typography.caption, color: colors.sage, marginLeft: spacing.xs }}>
                          Used {classification.usage_count} times
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.sm,
                        borderRadius: radius.xs,
                        backgroundColor: colors.errorTint,
                      }}
                      onPress={() => handleDelete(classification)}
                      disabled={deletingId === classification.id}
                    >
                      {deletingId === classification.id ? (
                        <Text style={{ ...typography.caption, color: colors.clay }}>
                          Deleting...
                        </Text>
                      ) : (
                        <>
                          <Trash2 size={16} color={colors.clay} strokeWidth={2} />
                          <Text
                            style={{
                              ...typography.caption,
                              color: colors.clay,
                              marginLeft: spacing.xs,
                            }}
                          >
                            Delete
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}

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