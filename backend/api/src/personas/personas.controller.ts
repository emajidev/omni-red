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
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Personas')
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
  @ApiOperation({
    summary: 'Listar personas paginadas con filtros opcionales',
    description:
      'Devuelve un listado paginado de personas. Admite filtros por estado, ubicación, texto libre, centro y tipo de sitio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de personas.',
    schema: {
      example: {
        data: [
          {
            id: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
            nombre: 'Juan Pérez',
            cedula: 'V-12.345.678',
            estado: 'desaparecido',
            ubicacion: 'Catia La Mar',
            lat: 10.6,
            lng: -67.03,
            edad: 35,
            fuente: 'web',
            created_at: '2026-06-29T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        size: 20,
      },
    },
  })
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
  @ApiOperation({
    summary: 'Buscar personas en fuentes externas (fvivemas + ayuda-api)',
    description:
      'Consulta simultáneamente múltiples fuentes externas de personas desaparecidas, fusiona los resultados, los re-rankea por relevancia y devuelve una lista deduplicada.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Término de búsqueda (nombre, cédula, etc.)', example: 'Juan Pérez' })
  @ApiResponse({
    status: 200,
    description: 'Resultados de búsqueda de fuentes externas, fusionados y deduplicados.',
    schema: {
      example: [
        {
          nombre: 'JUAN PEREZ',
          cedula: 'V-12345678',
          ubicacion: 'Caracas',
          estado: 'desaparecido',
          fuente: 'fvivemas',
        },
      ],
    },
  })
  async searchExternal(@Query('q') q?: string) {
    const term = q ?? '';
    const [fvivemas, ayuda] = await Promise.all([
      this.external.searchExternal(term),
      this.ayuda.searchExternal(term),
    ]);
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
  @ApiOperation({
    summary: 'Métricas consolidadas de fuentes externas de personas',
    description:
      'Combina las métricas de fvivemas y ayuda-api, eligiendo el valor máximo por categoría para los pills del dashboard.',
  })
  @ApiResponse({
    status: 200,
    description: 'Totales consolidados de fuentes externas.',
    schema: {
      example: {
        total_reportados: 18000,
        desaparecidos: 12000,
        localizados: 6000,
        fuentes: {
          fvivemas: { total_reportados: 18000, desaparecidos: 12000, localizados: 6000 },
          ayuda: { total_reportados: 15000, desaparecidos: 10000, localizados: 5000 },
        },
      },
    },
  })
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

  /**
   * GET /api/personas/external/mapa — personas del agregador externo para
   * PINTAR EN EL MAPA (deduplicadas, con estado clasificado y, cuando existe,
   * lat/lng). Las que no traen coordenadas las geocodifica el cliente por su
   * ubicación. Cacheado en el backend.
   */
  @Get('external/mapa')
  @ApiOperation({
    summary: 'Obtener personas de fuentes externas con coordenadas para el mapa',
    description:
      'Devuelve personas del agregador externo (ayuda-api) pre-procesadas para ser pintadas en el mapa de crisis. Incluye lat/lng cuando está disponible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de personas georreferenciadas de fuentes externas.',
    schema: {
      example: [
        {
          nombre: 'MARIA LOPEZ',
          estado: 'desaparecido',
          ubicacion: 'La Guaira',
          lat: 10.601,
          lng: -66.932,
          fuente: 'ayuda-api',
        },
      ],
    },
  })
  externalMapa() {
    return this.ayuda.personasMapa();
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
  @ApiOperation({ summary: 'Reportar una persona desaparecida, encontrada o fallecida' })
  @ApiResponse({
    status: 201,
    description: 'Persona registrada exitosamente (con desduplicación automática).',
    schema: {
      example: {
        id: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
        nombre: 'Juan Pérez',
        estado: 'desaparecido',
        ubicacion: 'Catia La Mar',
        lat: 10.6,
        lng: -67.03,
        created_at: '2026-06-29T10:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreatePersonaDto) {
    return this.personas.create(dto);
  }

  /** POST /api/personas/check-duplicates — desduplicación en servidor */
  @Post('check-duplicates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar cuáles filas ya existen en la base de datos (desduplicación previa)',
    description:
      'Recibe un arreglo de filas {nombre, cedula} y devuelve cuáles ya existen usando el mismo hash de deduplicación del servidor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mapa de hash → boolean indicando si cada fila ya existe.',
    schema: {
      example: {
        'hash_abc123': true,
        'hash_def456': false,
      },
    },
  })
  checkDuplicates(@Body() dto: CheckDuplicatesDto) {
    return this.personas.checkDuplicates(dto.rows);
  }

  /** POST /api/personas/batch — alta masiva (lista OCR) en transacción */
  @Post('batch')
  @ApiOperation({ summary: 'Registrar múltiples personas en masa desde una lista OCR' })
  @ApiResponse({
    status: 201,
    description: 'Personas registradas exitosamente en masa.',
    schema: {
      example: { procesados: 15, nuevos: 13, duplicados: 2, errores: 0 },
    },
  })
  createBatch(@Body() dto: BatchPersonasDto) {
    return this.personas.createBatch(dto.registros);
  }

  /** PATCH /api/personas/:id/centro — asigna el sitio (hospital/refugio) */
  @Patch(':id/centro')
  @ApiOperation({ summary: 'Asignar o desasignar una persona a un centro (hospital/refugio)' })
  @ApiParam({ name: 'id', description: 'ID único de la persona (UUID)', example: 'aa11bb22-cc33-dd44-ee55-ff6677889900' })
  @ApiResponse({
    status: 200,
    description: 'Persona asignada/desasignada del centro correctamente.',
    schema: {
      example: {
        id: 'aa11bb22-cc33-dd44-ee55-ff6677889900',
        nombre: 'Juan Pérez',
        centro_id: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
      },
    },
  })
  assignCentro(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignCentroDto,
  ) {
    return this.personas.assignCentro(id, dto.centro_id ?? null);
  }
}

