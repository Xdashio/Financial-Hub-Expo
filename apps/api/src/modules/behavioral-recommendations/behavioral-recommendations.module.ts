import { Module } from '@nestjs/common';
import { BehavioralRecommendationsService } from './behavioral-recommendations.service';
import { BehavioralRecommendationsController } from './behavioral-recommendations.controller';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [BehavioralRecommendationsService, SupabaseRepository],
  controllers: [BehavioralRecommendationsController],
  exports: [BehavioralRecommendationsService],
})
export class BehavioralRecommendationsModule {}