import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Low-level Supabase access. Wraps the client and centralizes the frontend
 * security best practices:
 *
 *   - Instantiated only with the `anon` (public) key. Never `service_role`.
 *   - WRITES go exclusively through `rpc(...)` (SECURITY DEFINER functions that
 *     validate on the server). No direct table `insert` is exposed.
 *   - Public READS use the masked view when applicable.
 *
 * In `mode: 'mock'` the client is NOT created; domain services resolve with
 * local data instead.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;

  readonly mode = environment.supabase.mode;
  readonly cfg = environment.supabase;

  get isLive(): boolean {
    return this.mode === 'supabase';
  }

  /** Lazy client. Only in `supabase` mode. */
  get db(): SupabaseClient {
    if (!this.isLive) {
      throw new Error('SupabaseService: in mock mode there is no client. Check the domain-service flow.');
    }
    if (!this.client) {
      this.client = createClient(this.cfg.url, this.cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return this.client;
  }

  /**
   * Read source for reports. When masking is enabled the public client reads
   * the VIEW with the obfuscated cédula (PII defense).
   */
  get reportsReadSource(): string {
    return this.cfg.usarVistaEnmascarada ? 'v_reportes_publico' : 'reportes_personas';
  }

  /**
   * Invoke a server-validated RPC. The only WRITE path allowed to the anon
   * client.
   *
   *   await supa.rpc('reportar_persona', { p_nombre, p_cedula, ... })
   */
  async rpc<T = unknown>(fn: string, params: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, params);
    if (error) throw error;
    return data as T;
  }

  /**
   * Realtime subscription to table changes. Returns an unsubscribe function.
   * No-op in mock mode.
   */
  onChanges(table: string, cb: () => void): () => void {
    if (!this.isLive || !this.cfg.realtime) return () => {};
    const channel = this.db
      .channel(`omni-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, cb)
      .subscribe();
    return () => { this.db.removeChannel(channel); };
  }
}
