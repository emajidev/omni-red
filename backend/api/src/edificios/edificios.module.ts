import { Module } from '@nestjs/common';
import { EdificiosController } from './edificios.controller';
import { EdificiosService } from './edificios.service';
import { EdificiosSyncService } from './edificios-sync.service';

@Module({
  controllers: [EdificiosController],
  providers: [EdificiosService, EdificiosSyncService],
})
export class EdificiosModule {}
