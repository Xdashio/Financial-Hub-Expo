import { Module } from '@nestjs/common';
import { DisciplineScoreService } from './discipline-score.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [DisciplineScoreService, SupabaseRepository],
  exports: [DisciplineScoreService],
})
export class DisciplineScoreModule {}
