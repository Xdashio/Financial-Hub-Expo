import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, SupabaseRepository],
})
export class MerchantModule {}