import { Injectable } from '@nestjs/common';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SupabaseRepository } from '../../database/supabase.repository';

const DEFAULT_PREFERENCES = {
  reallocation_confirms: true,
  cooling_off_reminders: true,
  savings_milestones: true,
  monthly_insights: false,
  tips_nudges: false,
};

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: SupabaseRepository) {}

  async getPreferences(userId: string): Promise<{
    preferences: {
      reallocation_confirms: boolean;
      cooling_off_reminders: boolean;
      savings_milestones: boolean;
      monthly_insights: boolean;
      tips_nudges: boolean;
    };
    user_id: string;
    updated_at: string | null;
    is_default?: boolean;
  }> {
    const existing = await this.repository.getNotificationPreferencesByUserId(userId);

    if (!existing) {
      // No row yet — the user hasn't changed anything from the defaults,
      // so there's nothing to persist. Reflect that with is_default rather
      // than silently writing a row on every read.
      return {
        preferences: { ...DEFAULT_PREFERENCES },
        user_id: userId,
        updated_at: null,
        is_default: true,
      };
    }

    return {
      preferences: {
        reallocation_confirms: existing.reallocation_confirms,
        cooling_off_reminders: existing.cooling_off_reminders,
        savings_milestones: existing.savings_milestones,
        monthly_insights: existing.monthly_insights,
        tips_nudges: existing.tips_nudges,
      },
      user_id: userId,
      updated_at: existing.updated_at,
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<{
    preferences: {
      reallocation_confirms: boolean;
      cooling_off_reminders: boolean;
      savings_milestones: boolean;
      monthly_insights: boolean;
      tips_nudges: boolean;
    };
    user_id: string;
    updated_at: string;
  }> {
    const updated = await this.repository.upsertNotificationPreferences(
      userId,
      dto,
      { user_id: userId, ...DEFAULT_PREFERENCES }
    );

    if (!updated) {
      throw new Error('Failed to update notification preferences');
    }

    return {
      preferences: {
        reallocation_confirms: updated.reallocation_confirms,
        cooling_off_reminders: updated.cooling_off_reminders,
        savings_milestones: updated.savings_milestones,
        monthly_insights: updated.monthly_insights,
        tips_nudges: updated.tips_nudges,
      },
      user_id: userId,
      updated_at: updated.updated_at,
    };
  }
}