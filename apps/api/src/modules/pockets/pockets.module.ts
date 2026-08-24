import { Module } from '@nestjs/common';
import { PocketsController } from './pockets.controller';
import { PocketsService } from './pockets.service';
import { EmergencyUnlockService } from './emergency-unlock.service';
import { SpendingAnalysisService } from '../insights/spending-analysis.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';
import { RunwayModule } from '../runway/runway.module';
import { DailyAllocationModule } from '../daily-allocation/daily-allocation.module';

@Module({
  imports: [DisciplineScoreModule, RunwayModule, DailyAllocationModule],
  controllers: [PocketsController],
  providers: [
    PocketsService,
    EmergencyUnlockService,
    SpendingAnalysisService,
    SupabaseRepository,
  ],
})
export class PocketsModule {}