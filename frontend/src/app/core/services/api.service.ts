import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CenterCapacity,
  Metrics,
  NewCenter,
  NewReport,
  PersonReport,
  PersonStatus,
  Quake,
  ReliefCenter,
  ReportResult,
} from '../models/models';

/** Resultado de la comprobación de duplicados en servidor. */
export interface DuplicateFlag {
  nombre: string;
  cedula: string | null;
  isDuplicate: boolean;
  collidesWithId?: string;
}

/** Resumen del alta masiva (lista OCR). */
export interface BatchResult {
  total: number;
  added: number;
  merged: number;
}

/**
 * Cliente HTTP de la API NestJS (backend/api). Centraliza todas las llamadas
 * al backend. Devuelve Promesas para encajar con el código async de los
 * servicios de dominio.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  // ---- Personas ------------------------------------------------------------
  getPersonas(estado?: PersonStatus): Promise<PersonReport[]> {
    const url = estado
      ? `${this.base}/personas?estado=${encodeURIComponent(estado)}`
      : `${this.base}/personas`;
    return firstValueFrom(this.http.get<PersonReport[]>(url));
  }

  createPersona(payload: NewReport): Promise<ReportResult> {
    return firstValueFrom(
      this.http.post<ReportResult>(`${this.base}/personas`, payload),
    );
  }

  /** Asigna (o limpia con null) el sitio (hospital/refugio) de una persona. */
  assignCentro(id: string, centroId: string | null): Promise<PersonReport> {
    return firstValueFrom(
      this.http.patch<PersonReport>(`${this.base}/personas/${id}/centro`, {
        centro_id: centroId,
      }),
    );
  }

  checkDuplicates(
    rows: { nombre: string; cedula: string | null }[],
  ): Promise<DuplicateFlag[]> {
    return firstValueFrom(
      this.http.post<DuplicateFlag[]>(`${this.base}/personas/check-duplicates`, {
        rows,
      }),
    );
  }

  createBatch(registros: NewReport[]): Promise<BatchResult> {
    return firstValueFrom(
      this.http.post<BatchResult>(`${this.base}/personas/batch`, { registros }),
    );
  }

  // ---- Centros de acopio ---------------------------------------------------
  getCentros(): Promise<ReliefCenter[]> {
    return firstValueFrom(this.http.get<ReliefCenter[]>(`${this.base}/centros`));
  }

  createCentro(payload: NewCenter): Promise<ReliefCenter> {
    return firstValueFrom(
      this.http.post<ReliefCenter>(`${this.base}/centros`, payload),
    );
  }

  updateCentro(
    id: string,
    capacidad: CenterCapacity,
    insumos: string[],
  ): Promise<ReliefCenter> {
    return firstValueFrom(
      this.http.patch<ReliefCenter>(`${this.base}/centros/${id}`, {
        capacidad,
        insumos_solicitados: insumos,
      }),
    );
  }

  // ---- Sismos --------------------------------------------------------------
  async getSismos(): Promise<Quake[]> {
    // Postgres devuelve las columnas `numeric` (magnitud, profundidad_km) como
    // string vía el driver pg; las convertimos a número (el modelo es number).
    // Devolvemos TODOS los sismos; el mapa filtra por fecha (CRISIS_SINCE),
    // el histórico los muestra completos.
    const rows = await firstValueFrom(
      this.http.get<Quake[]>(`${this.base}/sismos`),
    );
    return rows.map((q) => ({
      ...q,
      magnitud: Number(q.magnitud),
      profundidad_km: Number(q.profundidad_km),
      lat: Number(q.lat),
      lng: Number(q.lng),
    }));
  }

  // ---- Métricas ------------------------------------------------------------
  getMetricas(): Promise<Metrics> {
    return firstValueFrom(this.http.get<Metrics>(`${this.base}/metricas`));
  }

  // ---- Auth (gate de carga) ------------------------------------------------
  /** Valida credenciales de admin contra el backend. true si son correctas. */
  async login(usuario: string, password: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/auth/login`, { usuario, password }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
