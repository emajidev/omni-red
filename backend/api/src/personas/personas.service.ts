import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePersonaDto, ESTADOS } from './dto/create-persona.dto';
import { DupRowDto } from './dto/check-duplicates.dto';

@Injectable()
export class PersonasService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Lista de personas reportadas. Lee la VISTA pública con la cédula
   * enmascarada (defensa de PII). Filtrable por estado.
   */
  findAll(estado?: string) {
    if (estado) {
      if (!ESTADOS.includes(estado as any)) {
        throw new BadRequestException(
          `estado inválido. Valores: ${ESTADOS.join(', ')}`,
        );
      }
      return this.db.query(
        `select *
           from public.v_reportes_publico
          where estado = $1::estado_persona
          order by created_at desc`,
        [estado],
      );
    }
    return this.db.query(
      `select * from public.v_reportes_publico order by created_at desc`,
    );
  }

  /**
   * Alta de un reporte. Pasa por la RPC `reportar_persona`, que valida en
   * servidor y aplica la desduplicación (única vía de escritura permitida).
   * Devuelve { unificado, reporte }.
   */
  async create(dto: CreatePersonaDto) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.reportar_persona(
                $1, $2, $3::estado_persona, $4, $5, $6,
                $7::fuente_reporte, $8, $9, $10, $11
              ) as r`,
      [
        dto.nombre,
        dto.cedula ?? null,
        dto.estado,
        dto.ubicacion,
        dto.lat,
        dto.lng,
        dto.fuente ?? 'web',
        dto.edad ?? null,
        dto.telefono_contacto ?? null,
        dto.detalle ?? null,
        dto.reportado_por ?? null,
      ],
    );
    return row?.r;
  }

  /** Asigna (o limpia) el sitio (hospital/refugio) de una persona vía RPC. */
  async assignCentro(id: string, centroId: string | null) {
    const row = await this.db.queryOne<{ r: unknown }>(
      `select public.asignar_centro($1, $2) as r`,
      [id, centroId],
    );
    return row?.r;
  }

  /**
   * Desduplicación en servidor: para cada fila (nombre/cédula) indica si ya
   * existe un reporte con la misma huella (`calcular_hash_dedup`). Devuelve los
   * resultados en el mismo orden de entrada.
   */
  async checkDuplicates(rows: DupRowDto[]) {
    if (rows.length === 0) return [];
    const nombres = rows.map((r) => r.nombre);
    const cedulas = rows.map((r) => r.cedula ?? null);
    const found = await this.db.query<{
      nombre: string;
      cedula: string | null;
      collides_with_id: string | null;
    }>(
      `with input as (
         select t.nombre, t.cedula, t.ord
           from unnest($1::text[], $2::text[]) with ordinality as t(nombre, cedula, ord)
       )
       select i.nombre, i.cedula, r.id as collides_with_id
         from input i
         left join lateral (
           select id
             from public.reportes_personas
            where hash_dedup = public.calcular_hash_dedup(i.cedula, i.nombre)
            limit 1
         ) r on true
        order by i.ord`,
      [nombres, cedulas],
    );
    return found.map((row) => ({
      nombre: row.nombre,
      cedula: row.cedula,
      isDuplicate: row.collides_with_id !== null,
      collidesWithId: row.collides_with_id ?? undefined,
    }));
  }

  /**
   * Alta masiva en una transacción. Cada registro pasa por `reportar_persona`
   * (con desduplicación). Devuelve el recuento de nuevos vs. unificados.
   */
  async createBatch(items: CreatePersonaDto[]) {
    return this.db.withTransaction(async (client) => {
      let added = 0;
      let merged = 0;
      const reportes: unknown[] = [];
      for (const dto of items) {
        const res = await client.query<{
          r: { unificado: boolean; reporte: unknown };
        }>(
          `select public.reportar_persona(
                    $1, $2, $3::estado_persona, $4, $5, $6,
                    $7::fuente_reporte, $8, $9, $10, $11
                  ) as r`,
          [
            dto.nombre,
            dto.cedula ?? null,
            dto.estado,
            dto.ubicacion,
            dto.lat,
            dto.lng,
            dto.fuente ?? 'web',
            dto.edad ?? null,
            dto.telefono_contacto ?? null,
            dto.detalle ?? null,
            dto.reportado_por ?? null,
          ],
        );
        const j = res.rows[0].r;
        if (j?.unificado) merged++;
        else added++;
        reportes.push(j?.reporte);
      }
      return { total: items.length, added, merged, reportes };
    });
  }
}
