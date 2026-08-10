import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(512)
  // Expo push tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'token must be a valid Expo push token',
  })
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  device_id?: string;
}
