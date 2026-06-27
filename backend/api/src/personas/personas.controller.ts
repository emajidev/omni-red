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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PersonasService } from './personas.service';
import { ExternalSearchService } from './external-search.service';
import { AyudaSearchService } from './ayuda-search.service';
import { relevance } from './text-match';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { CheckDuplicatesDto } from './dto/check-duplicates.dto';
import { BatchPersonasDto } from './dto/batch-personas.dto';
import { AssignCentroDto } from './dto/assign-centro.dto';
import { QueryPersonasDto } from './dto/query-personas.dto';

@Controller('personas')
export class PersonasController {
  constructor(
    private readonly personas: PersonasService,
    private readonly external: ExternalSearchService,
    private readonly ayuda: AyudaSearchService,
  ) {}

  /**
   * GET /api/personas — listado paginado, con búsqueda y filtros.
   * Query: page, size, q, estado, ubicacion, centroId, tipo, all.
   * Rate limit propio (más estricto que el global): 120 req/min por IP.
   */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  findAll(@Query() query: QueryPersonasDto, @Req() req: Request) {
    return this.personas.findPaged(query, this.selfUrl(req, '/api/personas'));
  }

  /** URL absoluta del endpoint consultado (para el campo `fuente_api`). */
  private selfUrl(req: Request, path: string): string {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
    return host ? `${proto}://${host}${path}` : path;
  }

  /**
   * GET /api/personas/external?q=texto — búsqueda en las fuentes EXTERNAS
   * (fvivemas + ayuda-api), fusionada y deduplicada en el servidor. El cliente
   * solo manda el término. Devuelve [] con menos de 2 caracteres.
   */
  @Get('external')
  async searchExternal(@Query('q') q?: string) {
    const term = q ?? '';
    const [fvivemas, ayuda] = await Promise.all([
      this.external.searchExternal(term),
      this.ayuda.searchExternal(term),
    ]);
    // Re-rankea por relevancia a la consulta (ambas fuentes en una sola escala)
    // y luego deduplica conservando el primero (el más relevante).
    const ranked = [...fvivemas, ...ayuda]
      .map((p) => ({
        p,
        score: relevance(term, [
          { text: p.nombre, weight: 1 },
          { text: p.cedula, weight: 0.95 },
          { text: p.ubicacion, weight: 0.7 },
          { text: p.detalle, weight: 0.5 },
        ]),
      }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.p);
    return this.dedupePeople(ranked);
  }

  /**
   * GET /api/personas/external/metrics — totales para los pills del dashboard.
   * Compara las fuentes externas (fvivemas y ayuda-api) y devuelve, por
   * categoría, el MAYOR total (la fuente con más datos). Incluye el desglose
   * por fuente en `fuentes` para trazabilidad.
   */
  @Get('external/metrics')
  async externalMetrics() {
    const [fvivemas, ayuda] = await Promise.all([
      this.external.metrics(),
      this.ayuda.metrics(),
    ]);
    return {
      total_reportados: Math.max(fvivemas.total_reportados, ayuda.total_reportados),
      desaparecidos: Math.max(fvivemas.desaparecidos, ayuda.desaparecidos),
      localizados: Math.max(fvivemas.localizados, ayuda.localizados),
      fuentes: { fvivemas, ayuda },
    };
  }

  /** Deduplica personas externas por nombre+ubicación (normalizados). */
  private dedupePeople<T extends { nombre: string; ubicacion: string }>(
    rows: T[],
  ): T[] {
    const norm = (s: string) =>
      (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const seen = new Set<string>();
    const out: T[] = [];
    for (const r of rows) {
      const key = `${norm(r.nombre)}|${norm(r.ubicacion)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
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
