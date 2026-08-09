import { Module } from '@nestjs/common';
import { PocketsController } from './pockets.controller';
import { PocketsService } from './pockets.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreModule } from '../discipline-score/discipline-score.module';

@Module({
  imports: [DisciplineScoreModule],
  controllers: [PocketsController],
  providers: [PocketsService, SupabaseRepository],
})
export class PocketsModule {}