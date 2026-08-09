import { Module } from '@nestjs/common';
import { MerchantReportService } from './merchant-report.service';
import { SupabaseRepository } from '../../database/supabase.repository';

// This module intentionally has no controller of its own. The report-merchant
// HTTP routes (POST /merchant/report, GET /merchant/reports — see
// API_SPECIFICATION.md §2.3) already live on MerchantController under the
// `merchant` module. This module's job is to own MerchantReportService (now
// backed by the real `merchant_reports` table, see BACKEND_FRONTEND_AUDIT.md
// §C4) as a single source of truth and export it for MerchantModule to use,
// instead of each module declaring its own duplicate provider instance.
@Module({
  providers: [MerchantReportService, SupabaseRepository],
  exports: [MerchantReportService],
})
export class MerchantReportModule {}
