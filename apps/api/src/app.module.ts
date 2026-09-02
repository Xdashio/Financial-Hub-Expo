import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { LoansModule } from './modules/loans/loans.module';
import { DailyAllocationModule } from './modules/daily-allocation/daily-allocation.module';
import { PlanningCycleModule } from './modules/planning-cycle/planning-cycle.module';
import { BehavioralRecommendationsModule } from './modules/behavioral-recommendations/behavioral-recommendations.module';
import { MsmeProjectsModule } from './modules/msme-projects/msme-projects.module';
import { MsmeInvoicesModule } from './modules/msme-invoices/msme-invoices.module';
import { MsmeStockModule } from './modules/msme-stock/msme-stock.module';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    // Global default: 100 req/min per IP. Tighter limits can be set per-route
    // with @Throttle() later (auth-adjacent flows especially).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
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
    LoansModule,
    DailyAllocationModule,
    PlanningCycleModule,
    BehavioralRecommendationsModule,
    MsmeProjectsModule,
    MsmeInvoicesModule,
    MsmeStockModule,
  ],
  providers: [
    // Authenticated-by-default: new controllers are locked unless marked @Public().
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
