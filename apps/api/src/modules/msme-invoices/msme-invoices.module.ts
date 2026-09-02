import { Module } from '@nestjs/common';
import { MsmeInvoicesController } from './msme-invoices.controller';
import { MsmeInvoicesService } from './msme-invoices.service';

@Module({
  controllers: [MsmeInvoicesController],
  providers: [MsmeInvoicesService],
  exports: [MsmeInvoicesService],
})
export class MsmeInvoicesModule {}
