import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReallocationsController } from './reallocations.controller';
import { ReallocationsService } from './reallocations.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

describe('ReallocationsController', () => {
  let controller: ReallocationsController;
  let reallocationsService: jest.Mocked<ReallocationsService>;

  beforeEach(async () => {
    reallocationsService = {
      getForUser: jest.fn().mockResolvedValue([{ id: 'realloc-1' }]),
      create: jest.fn().mockResolvedValue({ id: 'realloc-1', status: 'pending' }),
      complete: jest.fn().mockResolvedValue({ id: 'realloc-1', status: 'completed' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReallocationsController],
      providers: [{ provide: ReallocationsService, useValue: reallocationsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReallocationsController>(ReallocationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists reallocations for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getAll(req);

    expect(reallocationsService.getForUser).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([{ id: 'realloc-1' }]);
  });

  it('creates a reallocation for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const body = { fromPocketId: 'a', toPocketId: 'b', amount: 100, reason: 'other' };

    const result = await controller.create(body, req);

    expect(reallocationsService.create).toHaveBeenCalledWith('user-123', body);
    expect(result).toEqual({ id: 'realloc-1', status: 'pending' });
  });

  it('completes a reallocation for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const body = { skipCoolingOff: true };

    const result = await controller.complete('realloc-1', body, req);

    expect(reallocationsService.complete).toHaveBeenCalledWith('user-123', 'realloc-1', body);
    expect(result).toEqual({ id: 'realloc-1', status: 'completed' });
  });
});