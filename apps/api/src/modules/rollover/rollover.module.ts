import { Module } from '@nestjs/common';
import { RolloverController } from './rollover.controller';
import { RolloverService } from './rollover.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [RolloverController],
  providers: [RolloverService, SupabaseRepository, DisciplineScoreService],
  exports: [RolloverService],
})
export class RolloverModule {}
