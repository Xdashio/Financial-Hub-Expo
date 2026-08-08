import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, SupabaseRepository],
  exports: [OnboardingService],
})
export class OnboardingModule {}