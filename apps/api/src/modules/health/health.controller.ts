import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../../auth/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return this.healthService.check();
  }

  @Get('detailed')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detailed health check with system metrics (authenticated)' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  detailed() {
    return this.healthService.detailed();
  }
}
