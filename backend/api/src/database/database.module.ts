import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Módulo global: cualquier servicio puede inyectar DatabaseService sin
 * reimportar este módulo.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
