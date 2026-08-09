import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantReportService } from '../merchant-report/merchant-report.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, MerchantReportService, SupabaseRepository],
})
export class MerchantModule {}