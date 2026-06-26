import { Controller, Get } from '@nestjs/common';
import { MetricasService } from './metricas.service';

@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  /** GET /api/metricas */
  @Get()
  get() {
    return this.metricas.get();
  }
}
