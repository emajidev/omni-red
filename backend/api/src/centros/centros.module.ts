import { Module } from '@nestjs/common';
import { CentrosController } from './centros.controller';
import { CentrosService } from './centros.service';

@Module({
  controllers: [CentrosController],
  providers: [CentrosService],
})
export class CentrosModule {}
