import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateCentroDto } from './dto/update-centro.dto';
import { CreateCentroDto } from './dto/create-centro.dto';
import { CentroBatchItemDto } from './dto/batch-centros.dto';

@Injectable()
export class CentrosService {
  constructor(private readonly db: DatabaseService) {}

  /** Lista de centros de acopio. */
  findAll() {
    return this.db.query(`select * from public.centros_acopio order by nombre`);
  }

  /** Alta de un centro de acopio vía RPC `crear_acopio` (escritura segura). */
  async create(dto: CreateCentroDto) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.crear_acopio($1, $2, $3, $4, $5, $6) as r`,
      [
        dto.nombre,
        dto.ubicacion,
        dto.lat,
        dto.lng,
        dto.contacto ?? null,
        dto.responsable ?? null,
      ],
    );
    return row?.r;
  }

  /**
   * Alta masiva de sitios (acopio/refugio/hospital) desde CSV, en una
   * transacción. Desduplica por `nombre` (no inserta si ya existe). Devuelve el
   * recuento de añadidos vs. omitidos.
   */
  async createBatch(items: CentroBatchItemDto[]) {
    return this.db.withTransaction(async (client) => {
      let added = 0;
      let skipped = 0;
      for (const it of items) {
        const res = await client.query(
          `insert into public.centros_acopio (nombre, ubicacion, lat, lng, tipo, contacto, responsable)
           select $1, $2, $3, $4, $5::tipo_centro, $6, $7
            where not exists (
              select 1 from public.centros_acopio c where lower(c.nombre) = lower($1)
            )
           returning id`,
          [
            it.nombre,
            it.ubicacion,
            it.lat,
            it.lng,
            it.tipo,
            it.contacto ?? null,
            it.responsable ?? null,
          ],
        );
        if (res.rowCount && res.rowCount > 0) added++;
        else skipped++;
      }
      return { total: items.length, added, skipped };
    });
  }

  /** Actualiza capacidad/insumos vía RPC `actualizar_acopio`. */
  async update(id: string, dto: UpdateCentroDto) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.actualizar_acopio($1, $2::capacidad_acopio, $3) as r`,
      [id, dto.capacidad, dto.insumos_solicitados],
    );
    return row?.r;
  }
}
