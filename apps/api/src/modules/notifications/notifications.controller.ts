import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushDeliveryService } from './push-delivery.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Notifications')
@Controller('notifications')
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushDelivery: PushDeliveryService,
  ) {}

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

  @Post('push-token')
  @ApiOperation({ summary: 'Register an Expo push token for this user' })
  @ApiResponse({ status: 200, description: 'Push token registered' })
  registerPushToken(@Body() dto: RegisterPushTokenDto, @Request() req: any) {
    return this.pushDelivery.registerToken(req.user.id, dto);
  }

  @Delete('push-token')
  @ApiOperation({ summary: 'Unregister an Expo push token' })
  @ApiResponse({ status: 200, description: 'Push token removed' })
  unregisterPushToken(@Query('token') token: string, @Request() req: any) {
    if (!token) {
      return { removed: false };
    }
    return this.pushDelivery.unregisterToken(req.user.id, token);
  }
}
