import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RolloverModule } from '../rollover/rollover.module';

@Module({
  imports: [RolloverModule],
  providers: [InsightsService, SupabaseRepository],
  controllers: [InsightsController],
})
export class InsightsModule {}
