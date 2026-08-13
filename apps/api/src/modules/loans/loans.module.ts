import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';

@Module({
  imports: [DisciplineScoreModule],
  controllers: [LoansController],
  providers: [LoansService, SupabaseRepository],
  exports: [LoansService],
})
export class LoansModule {}
