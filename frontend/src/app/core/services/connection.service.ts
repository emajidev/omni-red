import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Preferencia del usuario sobre el modo de la interfaz. */
export type ConnMode = 'auto' | 'lite' | 'full';
const MODE_KEY = 'somosuno-conn-mode';

/**
 * Detecta conexiones lentas para degradar a una vista LIGERA (sin mapa). Usa la
 * Network Information API (`navigator.connection`) — disponible en Chrome/Android,
 * el grueso del público móvil — reaccionando a sus cambios. Cuando esa API no
 * existe (Safari/Firefox), hace un único *probe* de latencia contra el backend.
 *
 * El usuario siempre puede forzar el modo con {@link setMode} (persistido); la
 * detección automática solo manda cuando la preferencia es `auto`.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  /** Preferencia del usuario: `auto` (detección), o forzar `lite`/`full`. */
  readonly mode = signal<ConnMode>(this.readMode());

  /** Detección automática (reactiva a cambios de red / probe). */
  private readonly autoSlow = signal<boolean>(this.detectFromApi());

  /** ¿Render en modo ligero (sin mapa)? Combina override + detección. */
  readonly lite = computed<boolean>(() => {
    const m = this.mode();
    if (m === 'lite') return true;
    if (m === 'full') return false;
    return this.autoSlow();
  });

  /** ¿La detección automática considera la conexión lenta? (para el aviso). */
  readonly detectedSlow = computed(() => this.autoSlow());

  constructor() {
    const c = this.conn();
    if (c && typeof c.addEventListener === 'function') {
      // Reacciona a cambios de red (p. ej. 4G → 2G al moverse).
      c.addEventListener('change', () => this.autoSlow.set(this.detectFromApi()));
    } else {
      // Sin Network Information API: un único sondeo de latencia al backend.
      void this.probeRtt();
    }
  }

  /** Fija el modo (auto/lite/full) y lo persiste. */
  setMode(mode: ConnMode): void {
    this.mode.set(mode);
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* modo privado */ }
  }

  /** Alterna entre forzar ligero y forzar mapa (para el interruptor manual). */
  toggle(): void {
    this.setMode(this.lite() ? 'full' : 'lite');
  }

  // --- internos -------------------------------------------------------------
  private conn(): any {
    const n = navigator as any;
    return n?.connection ?? n?.mozConnection ?? n?.webkitConnection ?? null;
  }

  private readMode(): ConnMode {
    try {
      const v = localStorage.getItem(MODE_KEY);
      if (v === 'lite' || v === 'full' || v === 'auto') return v as ConnMode;
    } catch { /* modo privado */ }
    return 'lite';
  }

  /** Heurística con la Network Information API. */
  private detectFromApi(): boolean {
    const c = this.conn();
    if (!c) return false; // sin API: decide el probe (o se queda en mapa)
    if (c.saveData === true) return true;                                   // ahorro de datos activado
    if (typeof c.effectiveType === 'string' && /(^|-)2g$/.test(c.effectiveType)) return true; // 2g / slow-2g
    if (typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 0.8) return true;     // < 0.8 Mbps
    if (typeof c.rtt === 'number' && c.rtt >= 1000) return true;                               // RTT muy alto
    return false;
  }

  /** Respaldo: mide la latencia a /health una vez; si es muy alta, marca lenta. */
  private async probeRtt(): Promise<void> {
    try {
      const t0 = performance.now();
      await fetch(`${environment.apiBaseUrl}/health`, { cache: 'no-store' });
      if (performance.now() - t0 >= 1500) this.autoSlow.set(true);
    } catch { /* sin red: no forzamos modo ligero */ }
  }
}
