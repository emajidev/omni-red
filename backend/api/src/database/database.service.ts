import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * Acceso a Postgres mediante un pool de conexiones (`pg`).
 *
 * Se conecta al POOLER IPv4 de Supabase (la conexión directa es IPv6-only).
 * La configuración llega por variables PG* en el .env.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  onModuleInit(): void {
    if (!process.env.PGHOST || !process.env.PGPASSWORD) {
      throw new Error(
        'Faltan variables de conexión (PGHOST/PGPASSWORD). Copia .env.example a .env.',
      );
    }
    this.pool = new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? 'postgres',
      ssl: { rejectUnauthorized: false }, // Supabase exige TLS
      max: 10,
      connectionTimeoutMillis: 15000,
    });
    this.logger.log(`Pool creado contra ${process.env.PGHOST}:${process.env.PGPORT ?? 5432}`);
  }

  /** Ejecuta una consulta y devuelve las filas. */
  async query<T extends QueryResultRow = any>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.pool.query<T>(text, params);
    return res.rows;
  }

  /** Ejecuta una consulta y devuelve la primera fila (o null). */
  async queryOne<T extends QueryResultRow = any>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /**
   * Ejecuta `fn` dentro de una transacción (BEGIN/COMMIT, ROLLBACK en error)
   * sobre un único cliente del pool.
   */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
