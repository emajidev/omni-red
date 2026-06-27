import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { DupRowDto } from './dto/check-duplicates.dto';
import { QueryPersonasDto } from './dto/query-personas.dto';

/** Tope de filas en modo `all` (mapa/métricas) para evitar respuestas enormes. */
const ALL_CAP = 10_000;

@Injectable()
export class PersonasService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Listado PAGINADO de personas reportadas. Lee la VISTA pública con la
   * cédula enmascarada (defensa de PII). Soporta búsqueda (nombre/cédula),
   * filtros (estado, ubicación, sitio concreto o categoría hospital/refugio)
   * y devuelve el desglose por estado del contexto de búsqueda.
   *
   * Con `all=true` ignora la paginación y devuelve todas las filas que matchean
   * (tope {@link ALL_CAP}); lo usan el mapa y las métricas.
   */
  async findPaged(query: QueryPersonasDto, fuenteApiUrl = '/api/personas') {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const all = query.all ?? false;

    // Construye la cláusula WHERE. `withEstado=false` omite el filtro de estado
    // (se usa para el desglose por estado del contexto de búsqueda).
    const build = (withEstado: boolean) => {
      const params: unknown[] = [];
      const conds: string[] = [];
      if (query.q?.trim()) {
        // Búsqueda TOLERANTE: sin acentos/mayúsculas (normalizar_texto = lower+
        // unaccent) y DIFUSA por trigramas (`%`, pg_trgm) además del substring,
        // para inferir por similitud y no solo por coincidencia exacta.
        params.push(query.q.trim());
        const i = params.length;
        conds.push(`(
          public.normalizar_texto(v.nombre)            ilike '%' || public.normalizar_texto($${i}) || '%'
          or public.normalizar_texto(v.ubicacion)      ilike '%' || public.normalizar_texto($${i}) || '%'
          or public.normalizar_texto(coalesce(v.cedula, '')) ilike '%' || public.normalizar_texto($${i}) || '%'
          or public.normalizar_texto(v.nombre)         %     public.normalizar_texto($${i})
          or public.normalizar_texto(v.ubicacion)      %     public.normalizar_texto($${i})
        )`);
      }
      if (query.ubicacion?.trim()) {
        params.push(`%${query.ubicacion.trim()}%`);
        conds.push(`v.ubicacion ilike $${params.length}`);
      }
      if (query.centroId) {
        params.push(query.centroId);
        conds.push(`v.centro_id = $${params.length}::uuid`);
      }
      if (query.tipo) {
        params.push(query.tipo);
        conds.push(
          `v.centro_id in (select id from public.centros_acopio where tipo = $${params.length}::public.tipo_centro)`,
        );
      }
      if (withEstado && query.estado) {
        params.push(query.estado);
        conds.push(`v.estado = $${params.length}::estado_persona`);
      }
      return { params, where: conds.length ? `where ${conds.join(' and ')}` : '' };
    };

    // ---- Desglose por estado (contexto de búsqueda, SIN filtro de estado) ----
    const bd = build(false);
    const breakdown = await this.db.query<{ estado: string; n: number }>(
      `select v.estado, count(*)::int as n
         from public.v_reportes_publico v
         ${bd.where}
        group by v.estado`,
      bd.params,
    );
    const counts: Record<string, number> = {
      desaparecido: 0,
      encontrado: 0,
      fallecido: 0,
      desconocido: 0,
    };
    for (const r of breakdown) counts[r.estado] = r.n;
    const totals = {
      personas: Object.values(counts).reduce((a, b) => a + b, 0),
      encontrados: counts.encontrado,
      desaparecidos: counts.desaparecido,
      fallecidos: counts.fallecido,
      desconocidos: counts.desconocido,
    };
    // Total para la paginación: respeta el filtro de estado si está presente.
    const total = query.estado ? counts[query.estado] ?? 0 : totals.personas;

    // ---- Página de datos (respeta TODOS los filtros) ----
    const pg = build(true);
    // Orden por RELEVANCIA cuando hay término: coincidencia por substring (boost)
    // + similitud trigram sobre el nombre; en empate, lo más reciente primero.
    let orderBy = 'order by v.created_at desc';
    if (query.q?.trim()) {
      pg.params.push(query.q.trim());
      const qi = pg.params.length;
      orderBy = `order by (
          (case when public.normalizar_texto(v.nombre) ilike '%' || public.normalizar_texto($${qi}) || '%' then 1.0 else 0 end)
          + similarity(public.normalizar_texto(v.nombre), public.normalizar_texto($${qi}))
        ) desc, v.created_at desc`;
    }
    let sql = `select *
                 from public.v_reportes_publico v
                 ${pg.where}
                ${orderBy}`;
    if (all) {
      sql += ` limit ${ALL_CAP}`;
    } else {
      pg.params.push(size);
      const limIdx = pg.params.length;
      pg.params.push((page - 1) * size);
      const offIdx = pg.params.length;
      sql += ` limit $${limIdx} offset $${offIdx}`;
    }
    const rows = await this.db.query<Record<string, unknown>>(sql, pg.params);
    // `fuente_api` = URL del API/fuente consultado (uniforme con los endpoints
    // externos). El `fuente` por fila (canal del reporte: web/twitter/ocr…) se
    // conserva intacto.
    const data = rows.map((r) => ({ ...r, fuente_api: fuenteApiUrl }));

    return {
      data,
      page: all ? 1 : page,
      size: all ? data.length : size,
      total,
      totalPages: all ? 1 : Math.max(1, Math.ceil(total / size)),
      totals,
    };
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
