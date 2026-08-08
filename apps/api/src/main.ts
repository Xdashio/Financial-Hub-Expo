import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Comma-separated allowlist, e.g. "https://app.example.com,http://localhost:8081".
// Falls back to FRONTEND_URL, then to the local Expo dev server.
function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:8081';
  return configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger describes every endpoint and payload shape — keep it off in
  // production unless explicitly opted in.
  const docsEnabled = !isProduction || process.env.ENABLE_SWAGGER === 'true';
  if (docsEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Financial Hub API')
      .setDescription('API for Financial Hub - Pocket-based money management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[API] API running on http://localhost:${port}`);
  if (docsEnabled) {
    console.log(`[DOCS] Swagger docs at http://localhost:${port}/docs`);
  }
}
bootstrap();