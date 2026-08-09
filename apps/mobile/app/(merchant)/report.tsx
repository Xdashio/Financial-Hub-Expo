import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { radius, spacing, typography, shadow } from '../../src/theme';
import { useTheme } from '@/theme/ThemeContext';
import { useAlertModal } from '@/hooks/useAlertModal';
import { merchantReportApi } from '@/services/api';
import {
  ArrowLeft,
  Flag,
  Check,
  LucideIcon,
} from 'lucide-react-native';

export default function ReportMerchantScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { recipientKey, transactionId } = useLocalSearchParams<{
    recipientKey: string;
    transactionId: string;
  }>();
  
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [suggestedCategory, setSuggestedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { alert, modal } = useAlertModal();

  const reportTypes = [
    { id: 'wrong_category', name: 'Wrong category', description: 'This payment was classified incorrectly' },
    { id: 'not_gambling', name: 'Not gambling', description: 'This is not a betting or gambling payment' },
    { id: 'wrong_amount', name: 'Wrong amount', description: 'The amount is incorrect' },
    { id: 'unknown_payee', name: 'Unknown payee', description: 'I don\'t recognize this merchant' },
  ];

  const handleSubmit = async () => {
    if (!selectedReportType) {
      alert('Missing Information', 'Please select a report type.');
      return;
    }

    try {
      setIsLoading(true);
      const { message } = await merchantReportApi.createReport({
        recipient_key: recipientKey,
        report_type: selectedReportType as 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee',
        description: description || undefined,
        transaction_id: transactionId || undefined,
        suggested_category: suggestedCategory || undefined,
      });

      await alert('Report submitted', message || 'Thank you for your report. We will review it and improve our classification.');
      router.back();
    } catch (error) {
      alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Report Merchant
          </Text>
        </View>

        {/* Context Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ 
            padding: spacing.lg, 
            borderRadius: radius.md, 
            backgroundColor: colors.surface, 
            borderWidth: 1, 
            borderColor: colors.line 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: radius.md, 
                backgroundColor: colors.goldTint, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Flag size={20} color={colors.gold} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ ...typography.heading, color: colors.ink }}>
                  {recipientKey}
                </Text>
                <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                  Help us improve our classification
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Report Type Selection */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            What's wrong?
          </Text>
          {reportTypes.map((type) => (
            <Pressable
              key={type.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: selectedReportType === type.id ? colors.emeraldDeep : colors.background,
                borderWidth: 1,
                borderColor: selectedReportType === type.id ? colors.emeraldDeep : colors.line,
                marginBottom: spacing.sm,
              }}
              onPress={() => setSelectedReportType(type.id)}
            >
              <View style={{ 
                width: 24, 
                height: 24, 
                borderRadius: radius.xs, 
                backgroundColor: selectedReportType === type.id ? colors.emeraldDeep + '20' : colors.lineSoft, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Flag size={14} color={selectedReportType === type.id ? colors.surface : colors.sage} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ 
                  ...typography.heading, 
                  color: selectedReportType === type.id ? colors.surface : colors.ink 
                }}>
                  {type.name}
                </Text>
                <Text style={{ 
                  ...typography.caption, 
                  color: selectedReportType === type.id ? `${colors.surface}CC` : colors.sage,
                  marginTop: 2 
                }}>
                  {type.description}
                </Text>
              </View>
              {selectedReportType === type.id && (
                <Check size={20} color={colors.surface} strokeWidth={2} />
              )}
            </Pressable>
          ))}
        </View>

        {/* Description Field */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Details (optional)
          </Text>
          <TextInput
            style={{
              ...typography.body,
              color: colors.ink,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
            placeholder="Tell us more about what happened..."
            placeholderTextColor={colors.sage}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Suggested Category */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Suggested category (optional)
          </Text>
          <TextInput
            style={{
              ...typography.body,
              color: colors.ink,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
            placeholder="e.g., groceries, transport..."
            placeholderTextColor={colors.sage}
            value={suggestedCategory}
            onChangeText={setSuggestedCategory}
          />
        </View>

        {/* Privacy Notice */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={{ 
            padding: spacing.md, 
            borderRadius: radius.xs, 
            backgroundColor: colors.emeraldTint 
          }}>
            <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
              🔒 Your report is private and will only be used to improve our classification system. We will not share your personal information.
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldDeep,
            }}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={{ ...typography.heading, color: colors.surface }}>
                Submitting...
              </Text>
            ) : (
              <>
                <Flag size={20} color={colors.surface} strokeWidth={2} />
                <Text style={{ ...typography.heading, color: colors.surface, marginLeft: spacing.sm }}>
                  Submit Report
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
      {modal}
    </SafeAreaView>
  );
}