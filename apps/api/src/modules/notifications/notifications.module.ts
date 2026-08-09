import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseRepository],
})
export class NotificationsModule {}