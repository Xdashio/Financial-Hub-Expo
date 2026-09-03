import { Module } from '@nestjs/common';
import { MsmeStockController } from './msme-stock.controller';
import { MsmeStockService } from './msme-stock.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [MsmeStockController],
  providers: [MsmeStockService, SupabaseRepository],
  exports: [MsmeStockService],
})
export class MsmeStockModule {}
