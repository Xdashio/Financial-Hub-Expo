import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDeliveryService } from './push-delivery.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';

@Module({
  imports: [DisciplineScoreModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeliveryService,
    NotificationSchedulerService,
    SupabaseRepository,
  ],
  exports: [NotificationsService, PushDeliveryService],
})
export class NotificationsModule {}
