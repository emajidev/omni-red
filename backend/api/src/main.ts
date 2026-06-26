import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { setDefaultAutoSelectFamily } from 'net';
import { AppModule } from './app.module';
import { PgExceptionFilter } from './common/pg-exception.filter';

// Habilita "Happy Eyeballs": si una ruta IPv6 falla, reintenta por IPv4. Evita
// el "fetch failed" intermitente hacia hosts solo-IPv6 (USGS/CloudFront) y hace
// más robustas todas las conexiones salientes (incluida Supabase).
setDefaultAutoSelectFamily(true);

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

  // CORS para el frontend Angular.
  // Si CORS_ORIGIN está definida (Railway) se usa; si no, caen estos defaults:
  // el dev server local + el frontend de producción en Railway.
  const defaultOrigins =
    'http://localhost:4200,https://omni-red-frontend-production.up.railway.app';
  const origin = (process.env.CORS_ORIGIN ?? defaultOrigins)
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  Logger.log(`OmniRed API escuchando en http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
