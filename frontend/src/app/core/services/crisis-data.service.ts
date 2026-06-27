import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, DuplicateFlag } from './api.service';
import {
  BatchUploadResult, CenterCapacity, CollapsedBuilding, ReliefCenter, Metrics,
  NewBuildingRow, NewCenter, NewCenterRow, NewReport,
  ExternalPerson, OcrRecord, PersonReport, PersonStatus, ReportResult, Quake
} from '../models/models';

/**
 * Tamaño de lote para subir/desduplicar listas grandes. Evita que la petición
 * exceda el límite de tamaño del backend (PayloadTooLarge) y permite mostrar
 * el avance "X de N" en la interfaz.
 */
export const OCR_BATCH_SIZE = 100;

/**
 * Data facade for OmniRed. Components talk only to this service. Internally it
 * consumes the NestJS API (backend/api) via {@link ApiService}.
 *
 * 🔐 Every write goes through the API (server-side validation + dedup). The
 *    deduplication logic lives on the server.
 */
@Injectable({ providedIn: 'root' })
export class CrisisDataService {
  private api = inject(ApiService);

  // --- Reactive state (signals) ---------------------------------------------
  readonly people = signal<PersonReport[]>([]);
  readonly centers = signal<ReliefCenter[]>([]);
  readonly quakes = signal<Quake[]>([]);
  readonly edificios = signal<CollapsedBuilding[]>([]);
  readonly loading = signal<boolean>(true);

  /**
   * Resultados del registro médico EXTERNO de fvivemas para el término de
   * búsqueda actual (solo lectura). La fuente y la lógica viven en el backend
   * ({@link ApiService.searchExternal}); aquí solo cacheamos la última
   * respuesta. NO entra en {@link metrics} ni en el mapa.
   */
  readonly external = signal<ExternalPerson[]>([]);
  private externalSeq = 0;

  // --- Derived: sitios por tipo ---------------------------------------------
  readonly acopios = computed(() => this.centers().filter((c) => c.tipo === 'acopio'));
  readonly refugios = computed(() => this.centers().filter((c) => c.tipo === 'refugio'));
  readonly hospitales = computed(() => this.centers().filter((c) => c.tipo === 'hospital'));

  /** The app always consumes real data from the API now. */
  readonly isLive = true;

  /** Derived metrics (computed from the loaded data). */
  readonly metrics = computed<Metrics>(() => {
    const p = this.people();
    return {
      total_reportados: p.length,
      desaparecidos: p.filter((x) => x.estado === 'desaparecido').length,
      localizados: p.filter((x) => x.estado === 'encontrado').length,
      criticos: p.filter((x) => x.estado === 'desaparecido' && x.veces_reportado >= 2).length,
      centros_activos: this.centers().filter((c) => c.tipo === 'acopio' && c.capacidad !== 'cerrado').length,
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
      const [people, centers, quakes, edificios] = await Promise.all([
        this.api.getPersonas(),
        this.api.getCentros(),
        this.api.getSismos(),
        // Resiliente: si el endpoint aún no está desplegado, no rompe la carga.
        this.api.getEdificios().catch(() => [] as CollapsedBuilding[]),
      ]);
      this.people.set(people);
      this.centers.set(centers);
      this.quakes.set(quakes);
      this.edificios.set(edificios);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Busca en el registro médico externo (fvivemas) vía backend y publica el
   * resultado en {@link external}. Resiliente: ante fallo deja la lista vacía.
   * Guard anti-carrera: si llegan respuestas desordenadas, solo aplica la de la
   * última petición.
   */
  async searchExternal(q: string): Promise<void> {
    const term = (q ?? '').trim();
    if (term.length < 2) {
      this.external.set([]);
      return;
    }
    const seq = ++this.externalSeq;
    try {
      const res = await this.api.searchExternal(term);
      if (seq === this.externalSeq) this.external.set(res);
    } catch {
      if (seq === this.externalSeq) this.external.set([]);
    }
  }

  // ==========================================================================
  // Write: report a person (server validates + deduplicates)
  // ==========================================================================
  async reportPerson(input: NewReport): Promise<ReportResult> {
    const result = await this.api.createPersona(input);
    await this.loadAll();
    return result;
  }

  // ==========================================================================
  // OCR: server-side duplicate detection against the live base
  // ==========================================================================
  /**
   * Flags each extracted row as duplicate or new (server cross-check). La
   * comprobación se envía por lotes ({@link OCR_BATCH_SIZE}) para no exceder el
   * límite de tamaño de petición del backend con listas grandes.
   */
  async analyzeOcrDuplicates(
    rows: { nombre: string; cedula: string | null; estado: PersonStatus; ubicacion: string; edad?: number | null }[]
  ): Promise<OcrRecord[]> {
    const flags: DuplicateFlag[] = [];
    for (let i = 0; i < rows.length; i += OCR_BATCH_SIZE) {
      const slice = rows
        .slice(i, i + OCR_BATCH_SIZE)
        .map((r) => ({ nombre: r.nombre, cedula: r.cedula }));
      flags.push(...(await this.api.checkDuplicates(slice)));
    }
    return rows.map((r, i) => ({
      ...r,
      isDuplicate: flags[i]?.isDuplicate ?? false,
      collidesWithId: flags[i]?.collidesWithId
    }));
  }

  /**
   * Guarda los registros extraídos (OCR/CSV) en LOTES (el servidor unifica
   * duplicados). Divide el envío en bloques de {@link OCR_BATCH_SIZE} para no
   * exceder el límite de tamaño de petición del backend, e informa el avance
   * vía `onProgress(cargados, total)`.
   */
  async saveOcrRecords(
    rows: OcrRecord[],
    onProgress?: (done: number, total: number) => void
  ): Promise<{ added: number; merged: number }> {
    const registros: NewReport[] = rows.map((r) => ({
      nombre: r.nombre, cedula: r.cedula, estado: r.estado, edad: r.edad ?? null,
      ubicacion: r.ubicacion, lat: this.jitter(10.4225), lng: this.jitter(-66.9510),
      fuente: 'ocr_lista', reportado_por: 'carga_ocr'
    }));
    const total = registros.length;
    let added = 0;
    let merged = 0;
    onProgress?.(0, total);
    for (let i = 0; i < total; i += OCR_BATCH_SIZE) {
      const slice = registros.slice(i, i + OCR_BATCH_SIZE);
      const res = await this.api.createBatch(slice);
      added += res.added;
      merged += res.merged;
      onProgress?.(Math.min(i + slice.length, total), total);
    }
    await this.loadAll();
    return { added, merged };
  }

  // ==========================================================================
  // Relief center: create / update
  // ==========================================================================
  async addCenter(input: NewCenter): Promise<ReliefCenter> {
    const center = await this.api.createCentro(input);
    await this.loadAll();
    return center;
  }

  // ==========================================================================
  // Carga masiva (CSV): sitios y edificios caídos
  // ==========================================================================
  /** Alta masiva de sitios (acopio/refugio/hospital). Servidor desduplica por nombre. */
  async saveCentersBatch(rows: NewCenterRow[]): Promise<BatchUploadResult> {
    const res = await this.api.createCentrosBatch(rows);
    await this.loadAll();
    return res;
  }

  /** Alta masiva de edificios caídos. Servidor desduplica por nombre. */
  async saveBuildingsBatch(rows: NewBuildingRow[]): Promise<BatchUploadResult> {
    const res = await this.api.createEdificiosBatch(rows);
    await this.loadAll();
    return res;
  }

  /** Asigna (o limpia con null) el sitio (hospital/refugio) de una persona. */
  async assignPersonCenter(personId: string, centerId: string | null): Promise<void> {
    await this.api.assignCentro(personId, centerId);
    await this.loadAll();
  }

  /** Valida credenciales de admin (gate de carga). */
  login(usuario: string, password: string): Promise<boolean> {
    return this.api.login(usuario, password);
  }

  async updateCenter(id: string, capacity: CenterCapacity, supplies: string[]): Promise<void> {
    await this.api.updateCentro(id, capacity, supplies);
    await this.loadAll();
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================
  /** Scatters OCR pins slightly so they don't stack on one coordinate. */
  private jitter(base: number): number {
    return base + (Math.random() - 0.5) * 0.04;
  }
}
