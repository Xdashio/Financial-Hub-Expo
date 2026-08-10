import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [SupabaseAuthGuard, Reflector],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
