import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Contador de visitas: total acumulado de cargas de la app. Persiste en la
 * tabla `visitas` (una sola fila). La tabla se crea al iniciar (idempotente)
 * para no depender de una migración manual; ante fallo de BD el contador
 * degrada a 0 sin romper la app.
 */
@Injectable()
export class VisitasService implements OnModuleInit {
  private readonly logger = new Logger(VisitasService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.db.query(
        `create table if not exists public.visitas (
           id smallint primary key default 1,
           total bigint not null default 0,
           actualizado_en timestamptz not null default now(),
           constraint visitas_fila_unica check (id = 1)
         );`,
      );
      await this.db.query(
        `insert into public.visitas (id, total) values (1, 0)
         on conflict (id) do nothing;`,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo preparar la tabla de visitas: ${(err as Error)?.message ?? err}`,
      );
    }
  }

  /** Suma una visita de forma atómica y devuelve el nuevo total. */
  async registrar(): Promise<number> {
    const row = await this.db.queryOne<{ total: string }>(
      `insert into public.visitas (id, total) values (1, 1)
       on conflict (id) do update
         set total = visitas.total + 1, actualizado_en = now()
       returning total;`,
    );
    return Number(row?.total ?? 0);
  }

  /** Total actual (sin incrementar). */
  async total(): Promise<number> {
    const row = await this.db.queryOne<{ total: string }>(
      `select total from public.visitas where id = 1;`,
    );
    return Number(row?.total ?? 0);
  }
}
