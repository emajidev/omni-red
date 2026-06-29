import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VisitasService } from './visitas.service';

@ApiTags('Visitas')
@Controller('visitas')
export class VisitasController {
  constructor(private readonly visitas: VisitasService) {}

  /** GET /api/visitas — total actual (sin sumar). */
  @Get()
  @ApiOperation({ summary: 'Obtener el contador total de visitas públicas al portal' })
  @ApiResponse({
    status: 200,
    description: 'Total de visitas registradas.',
    schema: { example: { total: 4821 } },
  })
  async total(): Promise<{ total: number }> {
    return { total: await this.visitas.total() };
  }

  /**
   * POST /api/visitas — registra una visita y devuelve el total.
   * Rate limit propio para que recargas/bots no inflen el contador.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar una visita al portal y obtener el total actualizado' })
  @ApiResponse({
    status: 200,
    description: 'Visita registrada. Devuelve el total actualizado.',
    schema: { example: { total: 4822 } },
  })
  async registrar(): Promise<{ total: number }> {
    return { total: await this.visitas.registrar() };
  }
}
