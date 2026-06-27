import { Module } from '@nestjs/common';
import { PersonasController } from './personas.controller';
import { PersonasService } from './personas.service';
import { ExternalSearchService } from './external-search.service';
import { AyudaSearchService } from './ayuda-search.service';

@Module({
  controllers: [PersonasController],
  providers: [PersonasService, ExternalSearchService, AyudaSearchService],
})
export class PersonasModule {}
