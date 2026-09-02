import { Module } from '@nestjs/common';
import { MsmeStockController } from './msme-stock.controller';
import { MsmeStockService } from './msme-stock.service';

@Module({
  controllers: [MsmeStockController],
  providers: [MsmeStockService],
  exports: [MsmeStockService],
})
export class MsmeStockModule {}
