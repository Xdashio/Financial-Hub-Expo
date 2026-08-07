import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn().mockReturnValue({
              status: 'ok',
              timestamp: new Date().toISOString(),
            }),
            detailed: jest.fn().mockReturnValue({
              status: 'ok',
              timestamp: new Date().toISOString(),
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status', () => {
      const result = controller.check();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(service.check).toHaveBeenCalled();
    });
  });

  describe('detailed', () => {
    it('should return detailed health status', () => {
      const result = controller.detailed();
      expect(result).toHaveProperty('status', 'ok');
      expect(service.detailed).toHaveBeenCalled();
    });
  });
});