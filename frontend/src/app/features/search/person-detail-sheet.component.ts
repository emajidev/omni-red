import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { UiService } from '../../core/services/ui.service';
import { ConnectionService } from '../../core/services/connection.service';
import { STATUS_CHIP, STATUS_LABEL, SOURCE_LABEL, timeAgo } from '../../core/util/labels';

@Component({
  selector: 'app-person-detail-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet [title]="person()?.nombre" subtitle="Ficha de información de persona" [icon]="person()?.estado === 'encontrado' ? 'safe' : 'alert'" (close)="ui.close()">
      <div class="space-y-4">
        @if (person(); as p) {
          <!-- Card de estado -->
          <div class="flex items-center justify-between rounded-2xl bg-appbg p-4 ring-1 ring-black/5">
            <span class="text-sm font-semibold text-textmuted">Estado de Búsqueda</span>
            <span class="rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm" [class]="chip(p.estado)" [style.background]="color(p.estado)">
              {{ label(p.estado) }}
            </span>
          </div>

          <!-- Información General -->
          <div class="rounded-2xl border border-black/5 bg-white dark:bg-[#2a2a2a]/95 p-4 space-y-3 shadow-sm">
            <div class="flex justify-between border-b border-black/5 pb-2">
              <span class="text-xs font-semibold text-textmuted">Cédula:</span>
              <span class="text-xs font-bold text-textmain">{{ p.cedula || 'Sin cédula registrada' }}</span>
            </div>
            <div class="flex justify-between border-b border-black/5 pb-2">
              <span class="text-xs font-semibold text-textmuted">Edad:</span>
              <span class="text-xs font-bold text-textmain">{{ p.edad ? p.edad + ' años' : 'No registrada' }}</span>
            </div>
            <div class="flex justify-between border-b border-black/5 pb-2">
              <span class="text-xs font-semibold text-textmuted">Ubicación física:</span>
              <span class="text-xs font-bold text-textmain text-right max-w-[200px] truncate" [title]="p.ubicacion">{{ p.ubicacion }}</span>
            </div>
            @if (p.telefono_contacto) {
              <div class="flex justify-between border-b border-black/5 pb-2">
                <span class="text-xs font-semibold text-textmuted">Teléfono de contacto:</span>
                <span class="text-xs font-bold text-info">📞 {{ p.telefono_contacto }}</span>
              </div>
            }
            <div class="flex justify-between border-b border-black/5 pb-2">
              <span class="text-xs font-semibold text-textmuted">Fuente del reporte:</span>
              <span class="text-xs font-bold text-textmain">{{ source(p.fuente) }}</span>
            </div>
            <div class="flex justify-between pb-1">
              <span class="text-xs font-semibold text-textmuted">Última actualización:</span>
              <span class="text-xs font-bold text-textmuted">{{ ago(p.created_at) }}</span>
            </div>
          </div>

          <!-- Detalles médicos y señas -->
          @if (p.detalle) {
            <div class="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Detalles / Observaciones</span>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">{{ p.detalle }}</p>
            </div>
          }

          <!-- Botón de acción para reportar como localizado (si está desaparecido) -->
          @if (p.estado === 'desaparecido') {
            <div class="pt-2">
              <button (click)="reportFound(p)" class="w-full flex justify-center items-center gap-2 rounded-2xl bg-gradient-to-tr from-green-600 to-green-400 py-3.5 text-sm font-bold text-white shadow-md hover:brightness-105 active:scale-[.98] transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Reportar como LOCALIZADO
              </button>
            </div>
          }

          <!-- Opción de ver en mapa si tiene coordenadas y no estamos en modo LITE -->
          @if (p.lat != null && p.lng != null && !conn.lite()) {
            <div class="pt-1">
              <button (click)="viewOnMap(p)" class="w-full flex justify-center items-center gap-2 rounded-2xl bg-appbg dark:bg-[#2a2a2a]/90 ring-1 ring-black/5 dark:ring-white/5 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[.98] transition">
                📍 Ver ubicación en el mapa
              </button>
            </div>
          }
        }
      </div>
    </app-bottom-sheet>
  `
})
export class PersonDetailSheetComponent {
  ui = inject(UiService);
  conn = inject(ConnectionService);
  person = this.ui.selectedPerson;

  chip = (s: any) => STATUS_CHIP[s as keyof typeof STATUS_CHIP];
  label = (s: any) => STATUS_LABEL[s as keyof typeof STATUS_LABEL];
  source = (s: any) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL];
  ago = (iso: string) => timeAgo(iso);

  color(estado: string): string {
    return estado === 'encontrado' ? 'var(--c-safe)' : estado === 'desaparecido' ? 'var(--c-alert)' : '#64748b';
  }

  reportFound(p: any): void {
    // Prefill the found report form with details of this person
    this.ui.openReportWithPrefill('encontrado', {
      nombre: p.nombre,
      cedula: p.cedula,
      edad: p.edad
    });
  }

  viewOnMap(p: any): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 });
  }
}
