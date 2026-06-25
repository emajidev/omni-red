import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { MOCK_CENTERS, MOCK_PEOPLE, MOCK_QUAKES } from '../data/mock-data';
import {
  CenterCapacity, ReliefCenter, Metrics, NewReport,
  OcrRecord, PersonReport, PersonStatus, ReportResult, Quake
} from '../models/models';

/**
 * Data facade for OmniRed. Components talk only to this service. Internally it
 * decides between MOCK data (demo) and Supabase (production).
 *
 * 🔐 Every write goes through `supa.rpc(...)` (server-side validation), never a
 *    direct `insert`. The dedup logic lives on the server; it is mirrored here
 *    only for the demo mode.
 */
@Injectable({ providedIn: 'root' })
export class CrisisDataService {
  private supa = inject(SupabaseService);

  // --- Reactive state (signals) ---------------------------------------------
  readonly people = signal<PersonReport[]>([]);
  readonly centers = signal<ReliefCenter[]>([]);
  readonly quakes = signal<Quake[]>([]);
  readonly loading = signal<boolean>(true);

  /** Derived metrics (computed in demo; RPC provides them in live mode). */
  readonly metrics = computed<Metrics>(() => {
    const p = this.people();
    return {
      total_reportados: p.length,
      desaparecidos: p.filter((x) => x.estado === 'desaparecido').length,
      localizados: p.filter((x) => x.estado === 'a_salvo').length,
      criticos: p.filter((x) => x.estado === 'desaparecido' && x.veces_reportado >= 2).length,
      centros_activos: this.centers().filter((c) => c.capacidad !== 'cerrado').length,
      sismos_24h: this.quakes().filter(
        (s) => Date.now() - new Date(s.ocurrido_en).getTime() < 86_400_000
      ).length
    };
  });

  // ==========================================================================
  // Initial load
  // ==========================================================================
  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      if (this.supa.isLive) {
        await this.loadFromSupabase();
        this.subscribeRealtime();
      } else {
        await this.sleep(250); // small delay to show the loading state
        this.people.set([...MOCK_PEOPLE]);
        this.centers.set([...MOCK_CENTERS]);
        this.quakes.set([...MOCK_QUAKES]);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async loadFromSupabase(): Promise<void> {
    // ---- READ: public client reads the masked view ------------------------
    // supabase.from('v_reportes_publico').select('*')
    const { data: people, error: e1 } = await this.supa.db
      .from(this.supa.reportsReadSource)
      .select('*')
      .order('created_at', { ascending: false });
    if (e1) throw e1;

    // supabase.from('centros_acopio').select('*')
    const { data: centers, error: e2 } = await this.supa.db
      .from('centros_acopio').select('*');
    if (e2) throw e2;

    // supabase.from('sismos').select('*').order('ocurrido_en', { ascending: false })
    const { data: quakes, error: e3 } = await this.supa.db
      .from('sismos').select('*').order('ocurrido_en', { ascending: false });
    if (e3) throw e3;

    this.people.set((people ?? []) as PersonReport[]);
    this.centers.set((centers ?? []) as ReliefCenter[]);
    this.quakes.set((quakes ?? []) as Quake[]);
  }

  private subscribeRealtime(): void {
    this.supa.onChanges('reportes_personas', () => this.loadFromSupabase());
    this.supa.onChanges('centros_acopio', () => this.loadFromSupabase());
    this.supa.onChanges('sismos', () => this.loadFromSupabase());
  }

  // ==========================================================================
  // Write: report a person (with deduplication)
  // ==========================================================================
  async reportPerson(input: NewReport): Promise<ReportResult> {
    if (this.supa.isLive) {
      // ✅ Only write path: server-validated RPC.
      const result = await this.supa.rpc<ReportResult>('reportar_persona', {
        p_nombre: input.nombre,
        p_cedula: input.cedula,
        p_estado: input.estado,
        p_ubicacion: input.ubicacion,
        p_lat: input.lat,
        p_lng: input.lng,
        p_fuente: input.fuente,
        p_edad: input.edad ?? null,
        p_telefono: input.telefono_contacto ?? null,
        p_detalle: input.detalle ?? null,
        p_reportado_por: input.reportado_por ?? null,
        p_lista_id: null
      });
      await this.loadFromSupabase();
      return result;
    }
    return this.reportPersonMock(input);
  }

  private reportPersonMock(input: NewReport): ReportResult {
    const hash = this.dedupHash(input.cedula, input.nombre);
    const current = this.people();
    const idx = current.findIndex((p) => this.dedupHash(p.cedula, p.nombre) === hash);

    if (idx >= 0) {
      // Merge (dedup): bump counter, do not duplicate the pin.
      const existing = current[idx];
      const merged: PersonReport = {
        ...existing,
        veces_reportado: existing.veces_reportado + 1,
        estado: input.estado === 'a_salvo' ? 'a_salvo' : existing.estado,
        ubicacion: input.ubicacion || existing.ubicacion,
        lat: input.lat, lng: input.lng,
        detalle: input.detalle || existing.detalle
      };
      const copy = [...current];
      copy[idx] = merged;
      this.people.set(copy);
      return { unificado: true, reporte: merged };
    }

    const report: PersonReport = {
      id: 'p-' + Math.random().toString(36).slice(2, 9),
      nombre: input.nombre.trim(),
      cedula: input.cedula,
      estado: input.estado,
      edad: input.edad ?? null,
      telefono_contacto: input.telefono_contacto ?? null,
      ubicacion: input.ubicacion || 'Desconocida',
      lat: input.lat, lng: input.lng,
      fuente: input.fuente,
      detalle: input.detalle ?? null,
      reportado_por: input.reportado_por ?? 'autorreporte',
      veces_reportado: 1,
      created_at: new Date().toISOString()
    };
    this.people.set([report, ...current]);
    return { unificado: false, reporte: report };
  }

  // ==========================================================================
  // OCR: duplicate detection against the current base
  // ==========================================================================
  /** Flags each extracted row as duplicate or new (cross-check with the base). */
  analyzeOcrDuplicates(
    rows: { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string }[]
  ): OcrRecord[] {
    const current = this.people();
    return rows.map((r) => {
      const hash = this.dedupHash(r.cedula, r.nombre);
      const collision = current.find((p) => this.dedupHash(p.cedula, p.nombre) === hash);
      return { ...r, isDuplicate: !!collision, collidesWithId: collision?.id };
    });
  }

  /** Saves the OCR-extracted rows (merging duplicates). */
  async saveOcrRecords(rows: OcrRecord[]): Promise<{ added: number; merged: number }> {
    let added = 0, merged = 0;
    for (const r of rows) {
      const res = await this.reportPerson({
        nombre: r.nombre, cedula: r.cedula, estado: r.estado,
        ubicacion: r.ubicacion, lat: this.jitter(10.4225), lng: this.jitter(-66.9510),
        fuente: 'ocr_lista', reportado_por: 'carga_ocr'
      });
      res.unificado ? merged++ : added++;
    }
    return { added, merged };
  }

  // ==========================================================================
  // Relief center: update capacity/supplies
  // ==========================================================================
  async updateCenter(id: string, capacity: CenterCapacity, supplies: string[]): Promise<void> {
    if (this.supa.isLive) {
      await this.supa.rpc('actualizar_acopio', { p_id: id, p_capacidad: capacity, p_insumos: supplies });
      await this.loadFromSupabase();
      return;
    }
    this.centers.set(this.centers().map((c) =>
      c.id === id ? { ...c, capacidad: capacity, insumos_solicitados: supplies } : c
    ));
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================
  /** Same fingerprint as the backend `calcular_hash_dedup`. */
  private dedupHash(cedula: string | null, nombre: string): string {
    const digits = (cedula ?? '').replace(/\D/g, '');
    if (digits) return 'ced:' + digits;
    return 'nom:' + this.normalize(nombre);
  }

  private normalize(s: string): string {
    return (s ?? '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/\s+/g, ' ').trim();
  }

  private jitter(base: number): number {
    return base + (Math.random() - 0.5) * 0.04;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
