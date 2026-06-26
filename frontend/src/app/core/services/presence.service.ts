import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Presencia: cuenta de usuarios conectados a la web en tiempo (casi) real.
 *
 * Manda un "latido" al backend cada 15 s; el servidor responde con cuántos
 * clientes están activos (latido en los últimos 30 s). El resultado se expone
 * como signal `online` para mostrarlo en la UI.
 */
@Injectable({ providedIn: 'root' })
export class PresenceService {
  private api = inject(ApiService);

  /** Usuarios conectados ahora mismo (incluido este). */
  readonly online = signal(0);

  private readonly clientId = this.resolveId();
  private timer?: ReturnType<typeof setInterval>;

  /** Arranca el latido periódico (idempotente). */
  start(): void {
    if (this.timer) return;
    void this.beat();
    this.timer = setInterval(() => void this.beat(), 15_000);
  }

  private async beat(): Promise<void> {
    try {
      const { online } = await this.api.presenceHeartbeat(this.clientId);
      this.online.set(online);
    } catch {
      // Un latido perdido no es crítico; se reintenta al siguiente ciclo.
    }
  }

  /** Id estable por pestaña (un refresco no duplica el conteo). */
  private resolveId(): string {
    const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      let id = sessionStorage.getItem('omni-cid');
      if (!id) {
        id = (globalThis.crypto?.randomUUID?.() ?? rnd());
        sessionStorage.setItem('omni-cid', id);
      }
      return id;
    } catch {
      return rnd();
    }
  }
}
