import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MetricasService {
  constructor(private readonly db: DatabaseService) {}

  /** Métricas agregadas del dashboard (RPC `obtener_metricas`). */
  async get() {
    const row = await this.db.queryOne<{ m: unknown }>(
      `select public.obtener_metricas() as m`,
    );
    return row?.m;
  }
}
