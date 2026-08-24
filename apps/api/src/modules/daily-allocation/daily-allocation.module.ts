import { Module } from '@nestjs/common';
import { DailyAllocationService } from './daily-allocation.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [DailyAllocationService, SupabaseRepository],
  exports: [DailyAllocationService],
})
export class DailyAllocationModule {}