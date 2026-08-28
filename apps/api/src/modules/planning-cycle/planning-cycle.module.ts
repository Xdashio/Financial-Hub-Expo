import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlanningCycleService } from './planning-cycle.service';
import { PlanningCycleController } from './planning-cycle.controller';
import { PlanningCycleCronService } from './planning-cycle.cron';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DailyAllocationModule } from '../daily-allocation/daily-allocation.module';

@Module({
  imports: [ScheduleModule.forRoot(), DailyAllocationModule],
  providers: [PlanningCycleService, PlanningCycleCronService, SupabaseRepository],
  controllers: [PlanningCycleController],
  exports: [PlanningCycleService],
})
export class PlanningCycleModule {}