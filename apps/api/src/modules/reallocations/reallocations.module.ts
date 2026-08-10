import { Module } from '@nestjs/common';
import { ReallocationsService } from './reallocations.service';
import { ReallocationsController } from './reallocations.controller';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DisciplineScoreModule, NotificationsModule],
  providers: [ReallocationsService, SupabaseRepository],
  controllers: [ReallocationsController],
})
export class ReallocationsModule {}
