import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SismosService } from './sismos.service';

@ApiTags('Sismos')
@Controller('sismos')
export class SismosController {
  constructor(private readonly sismos: SismosService) {}

  /** GET /api/sismos */
  @Get()
  @ApiOperation({ summary: 'Obtener todos los sismos registrados' })
  @ApiResponse({
    status: 200,
    description: 'Listado de sismos.',
    schema: {
      example: [
        {
          id: 'us6000abc1',
          magnitud: 4.2,
          lugar: '23 km al este de Carúpano, Venezuela',
          fecha: '2026-06-29T10:00:00.000Z',
          lat: 10.68,
          lng: -63.12,
          fuente: 'USGS',
          fuente_id: 'us6000abc1',
          created_at: '2026-06-29T10:05:00.000Z',
        },
      ],
    },
  })
  findAll() {
    return this.sismos.findAll();
  }

  /**
   * POST /api/sismos/sync — ingesta desde USGS (Venezuela).
   * Parámetros opcionales: ?days=7&minMagnitude=2.5
   */
  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar feed de sismos desde USGS (Servicio Geológico de EE. UU.)' })
  @ApiQuery({ name: 'days', required: false, description: 'Rango de días a sincronizar hacia atrás', example: '7' })
  @ApiQuery({ name: 'minMagnitude', required: false, description: 'Magnitud mínima a filtrar', example: '2.5' })
  @ApiResponse({
    status: 200,
    description: 'Resumen de la sincronización de sismos.',
    schema: {
      example: { procesados: 12, nuevos: 2, errores: 0 },
    },
  })
  sync(@Query('days') days?: string, @Query('minMagnitude') minMag?: string) {
    return this.sismos.syncFromUsgs({
      days: days ? Number(days) : undefined,
      minMagnitude: minMag ? Number(minMag) : undefined,
    });
  }
}
