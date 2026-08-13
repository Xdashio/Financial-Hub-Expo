import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

// Comma-separated allowlist, e.g. "https://app.example.com,http://localhost:8081".
// Falls back to FRONTEND_URL, then to the local Expo dev server.
function corsOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:8081';
  // Always include production Railway URL for web client support
  const productionUrl = 'https://api-production-8db1.up.railway.app';
  const origins = configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  
  // Add production URL if not already in the list
  if (!origins.includes(productionUrl)) {
    origins.push(productionUrl);
  }
  
  return origins;
}

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }

  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(helmet());
  app.setGlobalPrefix('api');

  const staticOrigins = corsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Always allow statically configured origins
      if (staticOrigins.includes(origin)) return callback(null, true);

      // In development, also allow any localhost port and ngrok tunnels.
      // Deliberately NOT matching *.up.railway.app here: railway.app is a
      // shared hosting domain anyone can get a subdomain on, so a blanket
      // regex effectively trusted every Railway-hosted origin on earth
      // (combined with `credentials: true`, that's a wildcard-with-cookies
      // hole). Specific Railway preview/staging URLs that legitimately need
      // access should be added explicitly via CORS_ORIGINS instead.
      if (!isProduction) {
        const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
        const isNgrok = /^https:\/\/[a-zA-Z0-9\-]+\.ngrok(-free)?\.app$/.test(origin) ||
                        /^https:\/\/[a-zA-Z0-9\-]+\.ngrok\.io$/.test(origin) ||
                        /^https:\/\/[a-zA-Z0-9\-]+\.ngrok-free\.dev$/.test(origin);
        if (isLocalhost || isNgrok) return callback(null, true);
      } else {
        // In production, allow the production Railway URL
        const isProductionRailway = /^https:\/\/api-production-8db1\.up\.railway\.app$/.test(origin);
        if (isProductionRailway) return callback(null, true);
      }

      callback(new Error(`CORS: origin "${origin}" not allowed`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'ngrok-skip-browser-warning',
      'Idempotency-Key',
      'X-Idempotency-Key',
    ],
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

  // Railway (and most PaaS) healthchecks hit the container from outside
  // localhost — bind all interfaces or the check fails with "service unavailable".
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://0.0.0.0:${port}`);
  if (docsEnabled) {
    logger.log(`Swagger docs at http://0.0.0.0:${port}/docs`);
  }
}
bootstrap();