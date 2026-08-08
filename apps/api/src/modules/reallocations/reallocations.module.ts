import { Module } from '@nestjs/common';
import { ReallocationsService } from './reallocations.service';
import { ReallocationsController } from './reallocations.controller';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [ReallocationsService, SupabaseRepository],
  controllers: [ReallocationsController]
})
export class ReallocationsModule {}