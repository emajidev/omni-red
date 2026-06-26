import { Module } from '@nestjs/common';
import { ListasController } from './listas.controller';
import { ListasService } from './listas.service';

@Module({
  controllers: [ListasController],
  providers: [ListasService],
})
export class ListasModule {}
