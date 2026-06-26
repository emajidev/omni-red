import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
})
export class AppModule {}
