import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReallocationsController } from './reallocations.controller';

describe('ReallocationsController', () => {
  let controller: ReallocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReallocationsController],
    }).compile();

    controller = module.get<ReallocationsController>(ReallocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
