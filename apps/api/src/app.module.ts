import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PocketsModule } from './modules/pockets/pockets.module';
import { AuthModule } from './auth/auth.module';
import { ReallocationsModule } from './modules/reallocations/reallocations.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ProfileModule } from './modules/profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    OnboardingModule,
    PocketsModule,
    AuthModule,
    ReallocationsModule,
    InsightsModule,
    ProfileModule,
  ],
})
export class AppModule {}