import { Body, Controller, Get, Post } from '@nestjs/common';
import { EdificiosService } from './edificios.service';
import { EdificiosSyncService } from './edificios-sync.service';
import { BatchEdificiosDto } from './dto/batch-edificios.dto';
import { CreateEdificioDto } from './dto/create-edificio.dto';

@Controller('edificios')
export class EdificiosController {
  constructor(
    private readonly edificios: EdificiosService,
    private readonly sync: EdificiosSyncService,
  ) {}

  /** GET /api/edificios — lista de edificios caídos */
  @Get()
  findAll() {
    return this.edificios.findAll();
  }

  /** POST /api/edificios — reporta (crea) un edificio afectado */
  @Post()
  create(@Body() dto: CreateEdificioDto) {
    return this.edificios.create(dto);
  }

  /** POST /api/edificios/batch — alta masiva desde CSV */
  @Post('batch')
  createBatch(@Body() dto: BatchEdificiosDto) {
    return this.edificios.createBatch(dto.registros);
  }

  /**
   * POST /api/edificios/sync — ingesta del mapa público de
   * terremotovenezuela.com hacia `edificios_caidos` (upsert idempotente).
   */
  @Post('sync')
  syncExternal() {
    return this.sync.syncFromTerremoto();
  }
}
