import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EdificioBatchItemDto } from './dto/batch-edificios.dto';
import { CreateEdificioDto } from './dto/create-edificio.dto';

@Injectable()
export class EdificiosService {
  constructor(private readonly db: DatabaseService) {}

  /** Lista de edificios caídos (más recientes primero). */
  findAll() {
    return this.db.query(
      `select * from public.edificios_caidos order by created_at desc`,
    );
  }

  /**
   * Reporta (crea) un edificio afectado. Los campos opcionales caen a sus
   * valores por defecto (nivel_dano=severo, personas_atrapadas=0,
   * estado=reportado). Devuelve la fila creada.
   */
  async create(dto: CreateEdificioDto) {
    return this.db.queryOne(
      `insert into public.edificios_caidos
         (nombre, ubicacion, lat, lng, nivel_dano, personas_atrapadas, estado, contacto)
       values ($1, $2, $3, $4,
               coalesce($5::nivel_dano, 'severo'),
               coalesce($6::int, 0),
               coalesce($7::estado_edificio, 'reportado'),
               $8)
       returning *`,
      [
        dto.nombre,
        dto.ubicacion,
        dto.lat,
        dto.lng,
        dto.nivel_dano ?? null,
        dto.personas_atrapadas ?? null,
        dto.estado ?? null,
        dto.contacto ?? null,
      ],
    );
  }

  /**
   * Alta masiva de edificios caídos desde CSV, en una transacción. Desduplica
   * por `nombre` (no inserta si ya existe). Devuelve añadidos vs. omitidos.
   */
  async createBatch(items: EdificioBatchItemDto[]) {
    return this.db.withTransaction(async (client) => {
      let added = 0;
      let skipped = 0;
      for (const it of items) {
        const res = await client.query(
          `insert into public.edificios_caidos
             (nombre, ubicacion, lat, lng, nivel_dano, personas_atrapadas, estado, contacto)
           select $1, $2, $3, $4,
                  coalesce($5::nivel_dano, 'severo'),
                  coalesce($6::int, 0),
                  coalesce($7::estado_edificio, 'reportado'),
                  $8
            where not exists (
              select 1 from public.edificios_caidos e where lower(e.nombre) = lower($1)
            )
           returning id`,
          [
            it.nombre,
            it.ubicacion,
            it.lat,
            it.lng,
            it.nivel_dano ?? null,
            it.personas_atrapadas ?? null,
            it.estado ?? null,
            it.contacto ?? null,
          ],
        );
        if (res.rowCount && res.rowCount > 0) added++;
        else skipped++;
      }
      return { total: items.length, added, skipped };
    });
  }
}
