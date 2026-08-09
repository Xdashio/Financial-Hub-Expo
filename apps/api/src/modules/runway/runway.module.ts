import { Module } from '@nestjs/common';
import { RunwayService } from './runway.service';
import { SupabaseRepository } from '../../database/supabase.repository';

// See docs/FREELANCER_RUNWAY.md. Exported so PocketsModule (the only
// current consumer) can inject RunwayService without duplicating its
// provider — keep this the single source of truth for that binding.
@Module({
  providers: [RunwayService, SupabaseRepository],
  exports: [RunwayService],
})
export class RunwayModule {}