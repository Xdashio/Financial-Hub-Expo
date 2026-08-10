import { Module } from '@nestjs/common';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RunwayModule } from '../runway/runway.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RunwayModule, NotificationsModule],
  controllers: [IncomeController],
  providers: [IncomeService, SupabaseRepository],
})
export class IncomeModule {}
