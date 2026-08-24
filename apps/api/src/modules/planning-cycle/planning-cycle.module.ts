import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PlanningCycleService } from './planning-cycle.service';
import { PlanningCycleController } from './planning-cycle.controller';
import { PlanningCycleCronService } from './planning-cycle.cron';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PlanningCycleService, PlanningCycleCronService, SupabaseRepository],
  controllers: [PlanningCycleController],
  exports: [PlanningCycleService],
})
export class PlanningCycleModule {}