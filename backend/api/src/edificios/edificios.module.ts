import { Module } from '@nestjs/common';
import { EdificiosController } from './edificios.controller';
import { EdificiosService } from './edificios.service';

@Module({
  controllers: [EdificiosController],
  providers: [EdificiosService],
})
export class EdificiosModule {}
