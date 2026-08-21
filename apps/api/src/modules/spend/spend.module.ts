import { Module } from '@nestjs/common';
import { SpendController } from './spend.controller';
import { SpendService } from './spend.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { RunwayModule } from '../runway/runway.module';

@Module({
  imports: [RunwayModule],
  controllers: [SpendController],
  providers: [SpendService, SupabaseRepository, DisciplineScoreService],
})
export class SpendModule {}