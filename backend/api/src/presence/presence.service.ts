import { Injectable } from '@nestjs/common';

/**
 * Presencia en tiempo real (usuarios conectados), en memoria.
 *
 * Cada cliente envía un "latido" periódico con su id; se considera "en línea"
 * si su último latido es más reciente que TTL_MS. Suficiente para una sola
 * instancia (Railway hobby). Si se escala a varias instancias, habría que mover
 * el estado a algo compartido (Redis); aquí no aplica.
 */
@Injectable()
export class PresenceService {
  /** clientId → timestamp (ms) del último latido. */
  private readonly seen = new Map<string, number>();

  /** Ventana de actividad: el cliente late cada ~15s; lo damos por ido a los 30s. */
  private static readonly TTL_MS = 30_000;

  /** Registra un latido y devuelve cuántos están en línea ahora. */
  heartbeat(clientId: string): number {
    this.seen.set(clientId, Date.now());
    return this.count();
  }

  /** Nº de clientes activos (purga los vencidos de paso). */
  count(): number {
    const cutoff = Date.now() - PresenceService.TTL_MS;
    for (const [id, t] of this.seen) {
      if (t < cutoff) this.seen.delete(id);
    }
    return this.seen.size;
  }
}
