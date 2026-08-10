import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PocketsModule } from './modules/pockets/pockets.module';
import { AuthModule } from './auth/auth.module';
import { ReallocationsModule } from './modules/reallocations/reallocations.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ProfileModule } from './modules/profile/profile.module';
import { IncomeModule } from './modules/income/income.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { MerchantReportModule } from './modules/merchant-report/merchant-report.module';
import { SpendModule } from './modules/spend/spend.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RolloverModule } from './modules/rollover/rollover.module';

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
    IncomeModule,
    MerchantModule,
    MerchantReportModule,
    SpendModule,
    NotificationsModule,
    RolloverModule,
  ],
})
export class AppModule {}