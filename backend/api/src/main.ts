import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PgExceptionFilter } from './common/pg-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas cuelgan de /api
  app.setGlobalPrefix('api');

  // Validación + saneo de los DTO de entrada
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Mapea errores de Postgres (validaciones de las RPC) a respuestas HTTP limpias
  app.useGlobalFilters(new PgExceptionFilter());

  // CORS para el frontend Angular
  const origin = (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',');
  app.enableCors({ origin });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  Logger.log(`OmniRed API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
