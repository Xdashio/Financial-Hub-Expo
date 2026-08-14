import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { radius, spacing, typography } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { pocketsApi } from '@/services/api';
import { useDataSync } from '@/services/data-sync';
import { ScreenContainer, Button, ConfirmModal, LoadingState, PocketGlyph } from '@/components/ui';
import { pocketGlyphKind } from '@/utils/pocketGlyph';
import { safeGoBack } from '@/utils/navigation';
import { ArrowLeft, Plus, Trash2, Edit3 } from 'lucide-react-native';

export default function PocketsManageModal() {
  const router = useRouter();
  const { colors } = useTheme();
  const dataSync = useDataSync();
  const [pockets, setPockets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPockets = React.useCallback(async () => {
    try {
      const data = await pocketsApi.getAll();
      setPockets(data);
    } catch (error) {
      console.error('Failed to load pockets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadPockets();
    }, [loadPockets]),
  );


  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await pocketsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadPockets();
      dataSync.bump();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not delete pocket');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = () => {
    router.push('/(modals)/pocket-create');
  };

  const handleEdit = (pocket: any) => {
    router.push(`/(modals)/pocket-edit?id=${pocket.id}`);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading pockets…" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)')} hitSlop={8}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.heading, color: colors.ink }}>Manage Pockets</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.sage, marginBottom: spacing.sm }}>
              {pockets.length}/6 pockets used
            </Text>
            {pockets.length >= 6 && (
              <Text style={{ ...typography.caption, color: colors.sage }}>
                You're using all 6 pockets. You can edit or delete existing pockets anytime.
              </Text>
            )}
          </View>

          {pockets.map((pocket) => {
            return (
              <View
                key={pocket.id}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: radius.sm,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
                    <PocketGlyph kind={pocketGlyphKind(pocket.kind)} size={20} color={colors.emeraldDeep} />
                  </View>
                  <View>
                    <Text style={{ ...typography.heading, color: colors.ink }}>{pocket.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                      {pocket.kind} {pocket.category ? `· ${pocket.category}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable
                    onPress={() => handleEdit(pocket)}
                    hitSlop={8}
                    style={{ padding: spacing.sm }}
                    accessibilityLabel={`Edit ${pocket.name}`}
                    accessibilityRole="button"
                  >
                    <Edit3 size={18} color={colors.ink} strokeWidth={2} />
                  </Pressable>
                  {pocket.kind !== 'savings' && (
                    <Pressable
                      onPress={() => setDeleteTarget(pocket)}
                      hitSlop={8}
                      style={{ padding: spacing.sm }}
                      accessibilityLabel={`Delete ${pocket.name}`}
                      accessibilityRole="button"
                    >
                      <Trash2 size={18} color={colors.clay} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          {pockets.length < 6 && (
            <Button
              fullWidth
              variant="outline"
              onPress={handleCreate}
              leftIcon={<Plus size={18} color={colors.emeraldDeep} strokeWidth={2} />}
              style={{ marginTop: spacing.md }}
            >
              Add Pocket
            </Button>
          )}
        </ScrollView>
      </View>

      <ConfirmModal
        visible={!!deleteTarget}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        message="This pocket will be deleted. Any remaining balance must be reallocated before deletion."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenContainer>
  );
}