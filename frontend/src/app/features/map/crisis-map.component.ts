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
  template: `<div #mapEl class="w-full h-full"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;
    }
  `]
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

    // Light mode map (CartoDB Voyager) for Apple-like aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.peopleLayer = L.layerGroup().addTo(this.map);
    this.centersLayer = L.layerGroup().addTo(this.map);

    // this.drawHighlightZones();
    this.frameVenezuela();

    this.renderMarkers(this.data.people(), this.data.centers());

    // Force Leaflet to recalculate map container size after DOM insertion
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 150);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // --- Initial framing: Venezuela centered --------
  private frameVenezuela(): void {
    // Center roughly on Venezuela
    this.map.setView([7.5, -66.0], 6);
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
    const dot = p.estado === 'a_salvo' ? '#38a169' : p.estado === 'desaparecido' ? '#e53e3e' : '#718096';
    const imgHtml = p.foto_url ? `<img src="${this.esc(p.foto_url)}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1)" />` : '';
    return `
      <div style="min-width:200px">
        ${imgHtml}
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="width:9px;height:9px;border-radius:50%;background:${dot};display:inline-block"></span>
          <strong style="font-size:14px;color:#1A202C">${this.esc(p.nombre)}</strong>
        </div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Cédula: <span style="color:#1A202C;font-weight:500">${this.esc(p.cedula ?? 'N/D')}</span></div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Estado: <span style="color:#1A202C;font-weight:500">${STATUS_LABEL[p.estado]}</span></div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Última ubicación: <span style="color:#1A202C;font-weight:500">${this.esc(p.ubicacion)}</span></div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Reporte: <span style="color:#1A202C;font-weight:500">${this.fmt(p.created_at)}</span></div>
        <div style="font-size:12px;color:#718096;margin-bottom:4px">Fuente: <span style="color:#1A202C;font-weight:500">${SOURCE_LABEL[p.fuente]}</span></div>
        ${p.veces_reportado > 1 ? `<div style="margin-top:6px;font-size:11px;color:#D69E2E;font-weight:600">⚑ Confirmado por ${p.veces_reportado} fuentes</div>` : ''}
      </div>`;
  }

  private centerPopup(c: ReliefCenter): string {
    const supplies = c.insumos_solicitados.length
      ? c.insumos_solicitados.map((s) => this.esc(s)).join(', ') : '—';
    return `
      <div style="min-width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="width:9px;height:9px;border-radius:50%;background:#2B6CB0;display:inline-block"></span>
          <strong style="font-size:14px;color:#1A202C">${this.esc(c.nombre)}</strong>
        </div>
        <div style="font-size:11px;color:#2B6CB0;font-weight:700;text-transform:uppercase;margin-bottom:6px">Centro de acopio</div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Ubicación: <span style="color:#1A202C;font-weight:500">${this.esc(c.ubicacion)}</span></div>
        <div style="font-size:12px;color:#718096;margin-bottom:2px">Insumos: <span style="color:#1A202C;font-weight:500">${supplies}</span></div>
        ${c.contacto ? `<div style="font-size:12px;color:#718096;margin-bottom:2px">Contacto: <span style="color:#1A202C;font-weight:500">${this.esc(c.contacto)}</span></div>` : ''}
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
