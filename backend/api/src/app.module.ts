import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { PersonasModule } from './personas/personas.module';
import { CentrosModule } from './centros/centros.module';
import { EdificiosModule } from './edificios/edificios.module';
import { PresenceModule } from './presence/presence.module';
import { SismosModule } from './sismos/sismos.module';
import { MetricasModule } from './metricas/metricas.module';
import { ListasModule } from './listas/listas.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global: 300 peticiones por minuto y por IP (los endpoints
    // pueden endurecerlo con @Throttle, p. ej. el listado de personas).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    PersonasModule,
    CentrosModule,
    EdificiosModule,
    PresenceModule,
    SismosModule,
    MetricasModule,
    ListasModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
