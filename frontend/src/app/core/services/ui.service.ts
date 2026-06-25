import { Injectable, signal } from '@angular/core';
import { PersonStatus } from '../models/models';

/** Which half-screen bottom sheet is open. */
export type Sheet = 'search' | 'report' | 'ocr' | 'centers' | null;

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

  /** Signal the map observes to recenter / open a marker. */
  readonly focus = signal<MapFocus | null>(null);

  /** Selected report id (highlighted in list/map). */
  readonly selectedId = signal<string | null>(null);

  /** Ephemeral notifications queue. */
  readonly toasts = signal<Toast[]>([]);
  private toastSeq = 0;

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
