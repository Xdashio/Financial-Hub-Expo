import { Module } from '@nestjs/common';
import { NudgesService } from './nudges.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RunwayModule } from '../runway/runway.module';
import { RolloverModule } from '../rollover/rollover.module';

// See nudges.service.ts. RunwayModule is imported (not just RunwayService
// provided directly) so this stays the single source of truth for that
// binding, same reasoning as PocketsModule/IncomeModule's existing
// RunwayModule imports.
@Module({
  imports: [RunwayModule, RolloverModule],
  providers: [NudgesService, SupabaseRepository],
  exports: [NudgesService],
})
export class NudgesModule {}