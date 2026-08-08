import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [InsightsService, SupabaseRepository],
  controllers: [InsightsController]
})
export class InsightsModule {}