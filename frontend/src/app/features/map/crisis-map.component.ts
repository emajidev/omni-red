import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, effect, inject, signal, viewChild
} from '@angular/core';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Circle as CircleGeom } from 'ol/geom';
import Overlay from 'ol/Overlay';
import { fromLonLat } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import { defaults as defaultControls } from 'ol/control';
import { Fill, Stroke, Style } from 'ol/style';
import { easeOut } from 'ol/easing';
import type { Coordinate } from 'ol/coordinate';

import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { HIGHLIGHT_ZONES } from '../../core/data/mock-data';
import { PersonReport, ReliefCenter } from '../../core/models/models';
import { SOURCE_LABEL, STATUS_LABEL } from '../../core/util/labels';

interface MarkerEntry {
  overlay: Overlay;
  coord: Coordinate;
  html: string;
}

@Component({
  selector: 'app-crisis-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #mapEl class="absolute inset-0 z-0"></div>
    @if (mapError()) {
      <div class="absolute inset-0 z-[1] grid place-items-center bg-ink-900 p-6 text-center">
        <div>
          <div class="text-lg font-bold text-alert">⚠️ Mapa no disponible</div>
          <div class="mx-auto mt-2 max-w-sm break-words text-xs text-slate-400">{{ mapError() }}</div>
        </div>
      </div>
    }
  `,
  styles: [`:host { position: absolute; inset: 0; display: block; }`]
})
export class CrisisMapComponent implements AfterViewInit, OnDestroy {
  private data = inject(CrisisDataService);
  private ui = inject(UiService);
  private mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  private map?: OlMap;
  private zonesLayer?: VectorLayer<VectorSource>;
  private markerOverlays: Overlay[] = [];
  private markersById = new Map<string, MarkerEntry>();
  private popupEl?: HTMLDivElement;
  private popupCloser?: HTMLButtonElement;
  private popupOverlay?: Overlay;
  readonly mapError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const people = this.data.people();
      const centers = this.data.centers();
      if (this.map) this.renderMarkers(people, centers);
    });

    effect(() => {
      const f = this.ui.focus();
      if (f && this.map) {
        this.flyTo(f.lat, f.lng, f.zoom ?? 15);
        if (f.id) {
          setTimeout(() => {
            const entry = this.markersById.get(f.id!);
            if (entry) this.openPopup(entry.html, entry.coord);
          }, 650);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    try {
      const cartoSource = new XYZ({
        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        attributions: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      });
      const osmSource = new XYZ({
        url: 'https://{a-d}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attributions: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      });

      const baseLayer = new TileLayer({ source: cartoSource });
      let swappedToOsm = false;
      cartoSource.on('tileloaderror', () => {
        if (!swappedToOsm) {
          swappedToOsm = true;
          console.warn('[OmniRed] CARTO no responde; cambiando a teselas de OpenStreetMap.');
          baseLayer.setSource(osmSource);
        }
      });

      this.zonesLayer = new VectorLayer({
        source: new VectorSource(),
        style: (feature) => {
          if (feature.get('kind') === 'label') return undefined;
          return new Style({
            stroke: new Stroke({ color: 'rgba(249,115,22,0.8)', width: 1.5, lineDash: [6, 6] }),
            fill: new Fill({ color: 'rgba(249,115,22,0.06)' })
          });
        }
      });

      this.map = new OlMap({
        target: this.mapEl().nativeElement,
        layers: [baseLayer, this.zonesLayer],
        view: new View({
          center: fromLonLat([-66.9036, 10.4806]),
          zoom: 8,
          maxZoom: 19
        }),
        controls: defaultControls({ attribution: true, zoom: true })
      });

      this.initPopup();
      this.drawHighlightZones();
      this.frameVenezuela();
      this.renderMarkers(this.data.people(), this.data.centers());

      setTimeout(() => this.map?.updateSize(), 0);
      setTimeout(() => this.map?.updateSize(), 350);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[OmniRed] No se pudo inicializar el mapa:', e);
      this.mapError.set(msg);
    }
  }

  ngOnDestroy(): void {
    this.map?.setTarget(undefined);
    this.map?.dispose();
  }

  private initPopup(): void {
    this.popupEl = document.createElement('div');
    this.popupEl.className = 'omni-ol-popup';

    this.popupCloser = document.createElement('button');
    this.popupCloser.className = 'omni-ol-popup-closer';
    this.popupCloser.type = 'button';
    this.popupCloser.setAttribute('aria-label', 'Cerrar');
    this.popupCloser.innerHTML = '&times;';
    this.popupCloser.addEventListener('click', () => this.closePopup());

    const content = document.createElement('div');
    content.className = 'omni-ol-popup-content';
    this.popupEl.appendChild(this.popupCloser);
    this.popupEl.appendChild(content);

    this.popupOverlay = new Overlay({
      element: this.popupEl,
      autoPan: { animation: { duration: 250 } },
      positioning: 'bottom-center',
      stopEvent: true,
      offset: [0, -14]
    });
    this.map!.addOverlay(this.popupOverlay);

    this.map!.on('click', (evt) => {
      const hit = this.map!.forEachFeatureAtPixel(evt.pixel, () => true);
      if (!hit) this.closePopup();
    });
  }

  private flyTo(lat: number, lng: number, zoom: number): void {
    const view = this.map!.getView();
    view.animate({
      center: fromLonLat([lng, lat]),
      zoom,
      duration: 800,
      easing: easeOut
    });
  }

  private frameVenezuela(): void {
    try {
      const coords = HIGHLIGHT_ZONES.map((z) => fromLonLat([z.lng, z.lat]));
      const extent = boundingExtent(coords);
      this.map!.getView().fit(extent, {
        padding: [80, 80, 160, 80],
        maxZoom: 9,
        duration: 0
      });
    } catch (e) {
      console.warn('[OmniRed] fitBounds falló; se mantiene la vista inicial:', e);
    }
  }

  private drawHighlightZones(): void {
    const source = this.zonesLayer!.getSource()!;
    for (const z of HIGHLIGHT_ZONES) {
      source.addFeature(new Feature({
        geometry: new CircleGeom(fromLonLat([z.lng, z.lat]), z.radiusKm * 1000)
      }));

      const labelEl = document.createElement('span');
      labelEl.className = 'omni-zona-label';
      labelEl.textContent = `📍 ${z.name}`;
      const labelOverlay = new Overlay({
        element: labelEl,
        position: fromLonLat([z.lng, z.lat]),
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -8]
      });
      this.map!.addOverlay(labelOverlay);
    }
  }

  private renderMarkers(people: PersonReport[], centers: ReliefCenter[]): void {
    for (const ov of this.markerOverlays) {
      this.map!.removeOverlay(ov);
    }
    this.markerOverlays = [];
    this.markersById.clear();

    for (const p of people) {
      const isMissing = p.estado === 'desaparecido';
      const cls = isMissing
        ? 'omni-pin omni-pin--alert omni-pin--pulse'
        : p.estado === 'a_salvo' ? 'omni-pin omni-pin--safe' : 'omni-pin';
      const coord = fromLonLat([p.lng, p.lat]);
      const html = this.personPopup(p);
      this.addMarker(p.id, coord, cls, html);
    }

    for (const c of centers) {
      const coord = fromLonLat([c.lng, c.lat]);
      const html = this.centerPopup(c);
      this.addMarker(c.id, coord, 'omni-pin omni-pin--info', html);
    }
  }

  private addMarker(id: string, coord: Coordinate, pinClass: string, html: string): void {
    const el = document.createElement('div');
    el.className = pinClass;
    el.style.cursor = 'pointer';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.openPopup(html, coord);
    });

    const overlay = new Overlay({
      element: el,
      position: coord,
      positioning: 'center-center',
      stopEvent: false
    });

    this.map!.addOverlay(overlay);
    this.markerOverlays.push(overlay);
    this.markersById.set(id, { overlay, coord, html });
  }

  private openPopup(html: string, coord: Coordinate): void {
    const content = this.popupEl!.querySelector('.omni-ol-popup-content') as HTMLDivElement;
    content.innerHTML = html;
    this.popupOverlay!.setPosition(coord);
  }

  private closePopup(): void {
    this.popupOverlay?.setPosition(undefined);
  }

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

  private esc(s: string): string {
    const map: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    return (s ?? '').replace(/[&<>"']/g, (c) => map[c]);
  }
}
