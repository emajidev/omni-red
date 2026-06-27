import { Injectable, signal } from '@angular/core';
import { CenterType, PersonStatus } from '../models/models';

/** Which half-screen bottom sheet is open. */
export type Sheet = 'search' | 'report' | 'ocr' | 'centers' | 'sismos' | 'refugios' | 'hospitales' | 'edificios' | 'report-building' | 'menu' | null;

/** Visual theme. Persisted in localStorage + reflected on <html>. */
export type Theme = 'light' | 'dark';
const THEME_KEY = 'somosuno-theme';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'alert' | 'warn';
}

/** Map focus target (when a result/marker is tapped). */
export interface MapFocus {
  lat: number; lng: number; zoom?: number; id?: string;
}

/**
 * INTERFACE state (not data). The app is a single view: the map in the
 * background plus at-hand buttons that pop up half-screen sheets. This service
 * coordinates which sheet is open and UI events.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  /** Active sheet (null = map only). */
  readonly sheet = signal<Sheet>(null);

  /** Search box text (real-time filter). */
  readonly query = signal<string>('');

  /** Status preselected when opening the report form. */
  readonly initialReportStatus = signal<PersonStatus>('desaparecido');

  /**
   * Sitio (hospital/refugio) a enfocar al abrir la hoja de instalaciones. Lo
   * fija {@link openFacility} cuando se toca un sitio en el mapa o en la lista,
   * y la {@link FacilitiesSheetComponent} lo consume al iniciar para abrir
   * directo su lista de personas. Se limpia tras consumirlo.
   */
  readonly facilityFocusId = signal<string | null>(null);

  /** Signal the map observes to recenter / open a marker. */
  readonly focus = signal<MapFocus | null>(null);

  /** Selected report id (highlighted in list/map). */
  readonly selectedId = signal<string | null>(null);

  /** Ephemeral notifications queue. */
  readonly toasts = signal<Toast[]>([]);
  private toastSeq = 0;

  /** Active theme (initialised from the class the pre-boot script set). */
  readonly theme = signal<Theme>(this.readInitialTheme());

  private readInitialTheme(): Theme {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
    return 'light';
  }

  /** Flip light <-> dark, persist, and reflect on <html>. */
  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
    }
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
  }

  open(sheet: Exclude<Sheet, null>): void {
    this.sheet.set(sheet);
  }

  close(): void {
    this.sheet.set(null);
  }

  toggle(sheet: Exclude<Sheet, null>): void {
    this.sheet.set(this.sheet() === sheet ? null : sheet);
  }

  openReport(status: PersonStatus): void {
    this.initialReportStatus.set(status);
    this.sheet.set('report');
  }

  /**
   * Abre la hoja de instalaciones (hospitales/refugios) enfocada en un sitio
   * concreto, mostrando directamente su lista de personas con buscador. Se usa
   * al tocar un hospital/refugio en el mapa o en la lista.
   */
  openFacility(tipo: CenterType, id: string): void {
    this.facilityFocusId.set(id);
    this.sheet.set(tipo === 'hospital' ? 'hospitales' : 'refugios');
  }

  /** Focus the map on a coordinate and optionally close the sheet. */
  focusOn(focus: MapFocus, closeSheet = true): void {
    this.selectedId.set(focus.id ?? null);
    this.focus.set({ zoom: 15, ...focus });
    if (closeSheet) this.close();
  }

  toast(text: string, kind: Toast['kind'] = 'info', ms = 4000): void {
    const id = ++this.toastSeq;
    this.toasts.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), ms);
  }
}
