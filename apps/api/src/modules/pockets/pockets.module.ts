import { Module } from '@nestjs/common';
import { PocketsController } from './pockets.controller';
import { PocketsService } from './pockets.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [PocketsController],
  providers: [PocketsService, SupabaseRepository],
})
export class PocketsModule {}