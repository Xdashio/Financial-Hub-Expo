import { Module } from '@nestjs/common';
import { MsmeInvoicesController } from './msme-invoices.controller';
import { MsmeInvoicesService } from './msme-invoices.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [MsmeInvoicesController],
  providers: [MsmeInvoicesService, SupabaseRepository],
  exports: [MsmeInvoicesService],
})
export class MsmeInvoicesModule {}
