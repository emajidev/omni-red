import { Controller, Get, Post, Query } from '@nestjs/common';
import { SismosService } from './sismos.service';

@Controller('sismos')
export class SismosController {
  constructor(private readonly sismos: SismosService) {}

  /** GET /api/sismos */
  @Get()
  findAll() {
    return this.sismos.findAll();
  }

  /**
   * POST /api/sismos/sync — ingesta desde USGS (Venezuela).
   * Parámetros opcionales: ?days=7&minMagnitude=2.5
   */
  @Post('sync')
  sync(@Query('days') days?: string, @Query('minMagnitude') minMag?: string) {
    return this.sismos.syncFromUsgs({
      days: days ? Number(days) : undefined,
      minMagnitude: minMag ? Number(minMag) : undefined,
    });
  }
}
