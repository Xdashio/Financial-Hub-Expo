import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RolloverModule } from '../rollover/rollover.module';
import { NudgesModule } from '../nudges/nudges.module';

@Module({
  imports: [RolloverModule, NudgesModule],
  providers: [InsightsService, SupabaseRepository],
  controllers: [InsightsController],
})
export class InsightsModule {}