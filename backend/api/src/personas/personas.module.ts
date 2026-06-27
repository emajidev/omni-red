import { Module } from '@nestjs/common';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';
import { ExternalSearchService } from './external-search.service';

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, ExternalSearchService],
})
export class PersonasModule {}
