import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PersonasService } from './personas.service';
import { ExternalSearchService } from './external-search.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { CheckDuplicatesDto } from './dto/check-duplicates.dto';
import { BatchPersonasDto } from './dto/batch-personas.dto';
import { AssignCentroDto } from './dto/assign-centro.dto';

@Controller('personas')
export class PersonasController {
  constructor(
    private readonly personas: PersonasService,
    private readonly external: ExternalSearchService,
  ) {}

  /** GET /api/personas?estado=desaparecido */
  @Get()
  findAll(@Query('estado') estado?: string) {
    return this.personas.findAll(estado);
  }

  /**
   * GET /api/personas/external?q=texto — fallback de búsqueda contra el
   * registro médico externo (fvivemas). La fuente y sus credenciales quedan
   * en el servidor; el cliente solo manda el término. Devuelve [] con menos
   * de 2 caracteres o si la fuente no está configurada/disponible.
   */
  @Get('external')
  searchExternal(@Query('q') q?: string) {
    return this.external.searchExternal(q ?? '');
  }

  /** POST /api/personas */
  @Post()
  create(@Body() dto: CreatePersonaDto) {
    return this.personas.create(dto);
  }

  /** POST /api/personas/check-duplicates — desduplicación en servidor */
  @Post('check-duplicates')
  @HttpCode(HttpStatus.OK)
  checkDuplicates(@Body() dto: CheckDuplicatesDto) {
    return this.personas.checkDuplicates(dto.rows);
  }

  /** POST /api/personas/batch — alta masiva (lista OCR) en transacción */
  @Post('batch')
  createBatch(@Body() dto: BatchPersonasDto) {
    return this.personas.createBatch(dto.registros);
  }

  /** PATCH /api/personas/:id/centro — asigna el sitio (hospital/refugio) */
  @Patch(':id/centro')
  assignCentro(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignCentroDto,
  ) {
    return this.personas.assignCentro(id, dto.centro_id ?? null);
  }
}
