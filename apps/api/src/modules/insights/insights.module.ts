import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RolloverModule } from '../rollover/rollover.module';
import { NudgesModule } from '../nudges/nudges.module';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';

@Module({
  imports: [RolloverModule, NudgesModule, DisciplineScoreModule],
  providers: [InsightsService, SupabaseRepository],
  controllers: [InsightsController],
})
export class InsightsModule {}