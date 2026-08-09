import { Module } from '@nestjs/common';
import { SpendController } from './spend.controller';
import { SpendService } from './spend.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [SpendController],
  providers: [SpendService, SupabaseRepository],
})
export class SpendModule {}