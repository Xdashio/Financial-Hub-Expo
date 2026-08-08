import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  providers: [ProfileService, SupabaseRepository],
  controllers: [ProfileController]
})
export class ProfileModule {}