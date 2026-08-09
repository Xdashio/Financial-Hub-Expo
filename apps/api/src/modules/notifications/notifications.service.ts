import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SupabaseRepository } from '../../database/supabase.repository';

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
    // Stub implementation - notification_preferences table doesn't exist yet
    // This will be implemented once the table is created in the database
    console.log('Notification preferences fetch stub for user:', userId);

    // Return default preferences
    return {
      preferences: {
        reallocation_confirms: true,
        cooling_off_reminders: true,
        savings_milestones: true,
        monthly_insights: false,
        tips_nudges: false,
      },
      user_id: userId,
      updated_at: null,
      is_default: true,
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
    // Stub implementation - notification_preferences table doesn't exist yet
    // This will be implemented once the table is created in the database
    console.log('Notification preferences update stub for user:', userId, dto);

    // Return the updated preferences (merged with defaults)
    const defaultPreferences = {
      reallocation_confirms: true,
      cooling_off_reminders: true,
      savings_milestones: true,
      monthly_insights: false,
      tips_nudges: false,
    };

    const updatedPreferences = {
      ...defaultPreferences,
      ...dto,
    };

    return {
      preferences: updatedPreferences,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };
  }
}