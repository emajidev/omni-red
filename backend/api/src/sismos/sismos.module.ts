import { Module } from '@nestjs/common';
import { SismosController } from './sismos.controller';
import { SismosService } from './sismos.service';

@Module({
  controllers: [SismosController],
  providers: [SismosService],
})
export class SismosModule {}
