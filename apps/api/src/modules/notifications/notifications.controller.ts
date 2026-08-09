import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getSettings(@Request() req: any) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated notification preferences' })
  @ApiResponse({ status: 400, description: 'Invalid preference data' })
  updateSettings(@Body() dto: UpdatePreferencesDto, @Request() req: any) {
    return this.notificationsService.updatePreferences(req.user.id, dto);
  }
}