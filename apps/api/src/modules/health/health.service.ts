import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }

  detailed() {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(mem.external / 1024 / 1024)} MB`,
      },
      cpu: process.cpuUsage(),
    };
  }
}