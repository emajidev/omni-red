import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VisitasService } from './visitas.service';

@Controller('visitas')
export class VisitasController {
  constructor(private readonly visitas: VisitasService) {}

  /** GET /api/visitas — total actual (sin sumar). */
  @Get()
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
  async registrar(): Promise<{ total: number }> {
    return { total: await this.visitas.registrar() };
  }
}
