import { Module } from '@nestjs/common';
import { ReallocationsService } from './reallocations.service';
import { ReallocationsController } from './reallocations.controller';

@Module({
  providers: [ReallocationsService],
  controllers: [ReallocationsController]
})
export class ReallocationsModule {}
