import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, effect, inject, viewChild
} from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { HIGHLIGHT_ZONES } from '../../core/data/mock-data';
import { PersonReport, ReliefCenter } from '../../core/models/models';
import { SOURCE_LABEL, STATUS_LABEL } from '../../core/util/labels';

// Leaflet is loaded from CDN (see index.html) and exposed as global `L`.
declare const L: any;

@Component({
  selector: 'app-crisis-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mapEl class="absolute inset-0 z-0"></div>`
})
export class CrisisMapComponent implements AfterViewInit, OnDestroy {
  private data = inject(CrisisDataService);
  private ui = inject(UiService);
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  private map: any;
  private peopleLayer: any;
  private centersLayer: any;
  private markersById = new Map<string, any>();

  constructor() {
    // Rebuild markers whenever the data changes.
    effect(() => {
      const people = this.data.people();
      const centers = this.data.centers();
      if (this.map) this.renderMarkers(people, centers);
    });

    // React to focus requests (tap on a result / metric).
    effect(() => {
      const f = this.ui.focus();
      if (f && this.map) {
        this.map.flyTo([f.lat, f.lng], f.zoom ?? 15, { duration: 0.8 });
        if (f.id) {
          const m = this.markersById.get(f.id);
          if (m) setTimeout(() => m.openPopup(), 650);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl().nativeElement, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    });

    // Dark base layer (CartoDB DarkMatter).
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.peopleLayer = L.layerGroup().addTo(this.map);
    this.centersLayer = L.layerGroup().addTo(this.map);

    this.drawHighlightZones();
    this.frameVenezuela();

    this.renderMarkers(this.data.people(), this.data.centers());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // --- Initial framing: Venezuela north-central, the 3 zones visible --------
  private frameVenezuela(): void {
    const bounds = L.latLngBounds(HIGHLIGHT_ZONES.map((z) => [z.lat, z.lng]));
    this.map.fitBounds(bounds.pad(0.6), { maxZoom: 9 });
  }

  // --- Highlight Caracas / La Guaira / Carabobo -----------------------------
  private drawHighlightZones(): void {
    for (const z of HIGHLIGHT_ZONES) {
      L.circle([z.lat, z.lng], {
        radius: z.radiusKm * 1000,
        color: '#f97316',          // warn/orange outline = focus area
        weight: 1.5,
        opacity: 0.8,
        dashArray: '6 6',
        fillColor: '#f97316',
        fillOpacity: 0.06
      }).addTo(this.map);

      L.marker([z.lat, z.lng], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<span class="omni-zona-label">📍 ${this.esc(z.name)}</span>`,
          iconSize: [0, 0]
        })
      }).addTo(this.map);
    }
  }

  // --- Markers --------------------------------------------------------------
  private renderMarkers(people: PersonReport[], centers: ReliefCenter[]): void {
    this.peopleLayer.clearLayers();
    this.centersLayer.clearLayers();
    this.markersById.clear();

    for (const p of people) {
      const isMissing = p.estado === 'desaparecido';
      const cls = isMissing
        ? 'omni-pin omni-pin--alert omni-pin--pulse'
        : p.estado === 'a_salvo' ? 'omni-pin omni-pin--safe' : 'omni-pin';
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
      }).bindPopup(this.personPopup(p), { maxWidth: 280 });
      marker.addTo(this.peopleLayer);
      this.markersById.set(p.id, marker);
    }

    for (const c of centers) {
      const marker = L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: '', html: `<div class="omni-pin omni-pin--info"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
      }).bindPopup(this.centerPopup(c), { maxWidth: 280 });
      marker.addTo(this.centersLayer);
      this.markersById.set(c.id, marker);
    }
  }

  // --- Popups (content escaped: defends against XSS in live data) -----------
  private personPopup(p: PersonReport): string {
    const dot = p.estado === 'a_salvo' ? '#22c55e' : p.estado === 'desaparecido' ? '#ef4444' : '#94a3b8';
    return `
      <div style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:9px;height:9px;border-radius:50%;background:${dot};display:inline-block"></span>
          <strong style="font-size:14px">${this.esc(p.nombre)}</strong>
        </div>
        <div style="font-size:12px;color:#94a3b8">Cédula: <span style="color:#e2e8f0">${this.esc(p.cedula ?? 'N/D')}</span></div>
        <div style="font-size:12px;color:#94a3b8">Estado: <span style="color:#e2e8f0">${STATUS_LABEL[p.estado]}</span></div>
        <div style="font-size:12px;color:#94a3b8">Última ubicación: <span style="color:#e2e8f0">${this.esc(p.ubicacion)}</span></div>
        <div style="font-size:12px;color:#94a3b8">Reporte: <span style="color:#e2e8f0">${this.fmt(p.created_at)}</span></div>
        <div style="font-size:12px;color:#94a3b8">Fuente: <span style="color:#e2e8f0">${SOURCE_LABEL[p.fuente]}</span></div>
        ${p.veces_reportado > 1 ? `<div style="margin-top:4px;font-size:11px;color:#f97316">⚑ Confirmado por ${p.veces_reportado} fuentes</div>` : ''}
      </div>`;
  }

  private centerPopup(c: ReliefCenter): string {
    const supplies = c.insumos_solicitados.length
      ? c.insumos_solicitados.map((s) => this.esc(s)).join(', ') : '—';
    return `
      <div style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:9px;height:9px;border-radius:50%;background:#3b82f6;display:inline-block"></span>
          <strong style="font-size:14px">${this.esc(c.nombre)}</strong>
        </div>
        <div style="font-size:12px;color:#94a3b8">Centro de acopio</div>
        <div style="font-size:12px;color:#94a3b8">Ubicación: <span style="color:#e2e8f0">${this.esc(c.ubicacion)}</span></div>
        <div style="font-size:12px;color:#94a3b8">Insumos: <span style="color:#e2e8f0">${supplies}</span></div>
        ${c.contacto ? `<div style="font-size:12px;color:#94a3b8">Contacto: <span style="color:#e2e8f0">${this.esc(c.contacto)}</span></div>` : ''}
      </div>`;
  }

  private fmt(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  /** Minimal HTML escaping for values injected into popup markup. */
  private esc(s: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    return (s ?? '').replace(/[&<>"']/g, (c) => map[c]);
  }
}
