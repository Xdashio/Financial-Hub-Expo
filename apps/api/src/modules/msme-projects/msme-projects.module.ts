import { Module } from '@nestjs/common';
import { MsmeProjectsController } from './msme-projects.controller';
import { ProjectsService } from './projects.service';
import { FundingCascadeService } from './funding-cascade.service';
import { SupabaseRepository } from '../../database/supabase.repository';

@Module({
  controllers: [MsmeProjectsController],
  providers: [
    ProjectsService,
    FundingCascadeService,
    SupabaseRepository,
  ],
  exports: [ProjectsService, FundingCascadeService],
})
export class MsmeProjectsModule {}