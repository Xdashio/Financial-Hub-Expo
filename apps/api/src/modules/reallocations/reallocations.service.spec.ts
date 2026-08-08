import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReallocationsService } from './reallocations.service';

describe('ReallocationsService', () => {
  let service: ReallocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReallocationsService],
    }).compile();

    service = module.get<ReallocationsService>(ReallocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
