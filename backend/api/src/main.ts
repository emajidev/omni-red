import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { setDefaultAutoSelectFamily } from 'net';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('OmniRed API')
    .setDescription('Documentación de la API de OmniRed para la gestión de crisis y respuesta a desastres')
    .setVersion('1.0.0')
    .addTag('Auth', 'Autenticación de administradores')
    .addTag('Centros de Acopio', 'Gestión de centros de acopio, refugios y hospitales')
    .addTag('Edificios Afectados', 'Registro y consulta de edificios colapsados o dañados')
    .addTag('Personas', 'Reportes de personas desaparecidas, encontradas o fallecidas')
    .addTag('Sismos', 'Registro y sincronización de eventos sísmicos')
    .addTag('Metricas', 'Estadísticas del panel de control')
    .addTag('Visitas', 'Contador de visitas públicas')
    .addTag('Presence', 'Registro de usuarios activos en línea')
    .addTag('Listas', 'Gestión de listas/censos de personas')
    .addTag('Health', 'Estado de salud del servicio y base de datos')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
  });

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
