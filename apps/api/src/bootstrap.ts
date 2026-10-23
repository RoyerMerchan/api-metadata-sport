import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json } from 'express';
import { ApiExceptionFilter } from './common/http';
import { readEnv } from './config/env';
export function configureApp(app: INestApplication) {
  const env = readEnv();
  app.getHttpAdapter().getInstance().set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  app.setGlobalPrefix('api/v1'); app.enableShutdownHooks(); app.use(helmet()); app.use(json({ limit: '4mb' }));
  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map(s => s.trim()), credentials: false, allowedHeaders: ['Content-Type', 'Authorization'], methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  const logger = new Logger('Request');
  app.use((req: any, res: any, next: any) => { const start = Date.now(); res.on('finish', () => logger.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`)); next(); });
  if (env.NODE_ENV !== 'production') SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('FOOTLAB API').setVersion('1.0').addBearerAuth().build()));
  return env;
}
