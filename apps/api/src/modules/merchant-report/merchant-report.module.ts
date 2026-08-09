import { Module } from '@nestjs/common';
import { MerchantReportController } from './merchant-report.controller';
import { MerchantReportService } from './merchant-report.service';
import { SupabaseRepository } from '../../database/supabase.repository';

// This module owns the report-merchant HTTP routes (POST /merchant/report,
// GET /merchant/reports — see API_SPECIFICATION.md §2.3), backed by the
// real `merchant_reports` table (see BACKEND_FRONTEND_AUDIT.md §C4). It was
// previously written but never registered in app.module.ts, and its
// controller had drifted onto an undocumented `merchant-report` path prefix
// while MerchantController grew a duplicate copy of the same two routes
// under the correct `merchant` prefix. Registering this module now means
// picking one home for these routes rather than shipping both: the
// controller here mounts at `merchant` (matching the spec) and the
// duplicate handlers were removed from MerchantController.
@Module({
  controllers: [MerchantReportController],
  providers: [MerchantReportService, SupabaseRepository],
})
export class MerchantReportModule {}
