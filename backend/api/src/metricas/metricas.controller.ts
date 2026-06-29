import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricasService } from './metricas.service';

@ApiTags('Metricas')
@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  /** GET /api/metricas */
  @Get()
  @ApiOperation({ summary: 'Obtener métricas agregadas para el panel de control' })
  @ApiResponse({
    status: 200,
    description: 'Métricas generales del sistema.',
    schema: {
      example: {
        total_desaparecidos: 12,
        total_encontrados: 85,
        total_fallecidos: 3,
        total_personas: 100,
        centros_activos: 5,
        edificios_colapsados: 8,
      },
    },
  })
  get() {
    return this.metricas.get();
  }
}
