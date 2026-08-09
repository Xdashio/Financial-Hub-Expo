import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantReportModule } from '../merchant-report/merchant-report.module';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  imports: [MerchantReportModule],
  controllers: [MerchantController],
  providers: [MerchantService, SupabaseRepository],
})
export class MerchantModule {}