import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, effect, inject, viewChild
} from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { HIGHLIGHT_ZONES } from '../../core/data/map-zones';
import { VENEZUELA_OUTLINE } from '../../core/data/ve-outline';
import { PersonReport, Quake, ReliefCenter } from '../../core/models/models';
import { CRISIS_SINCE, SOURCE_LABEL, STATUS_LABEL } from '../../core/util/labels';

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
  private quakesLayer: any;
  private tileLayer: any;
  private outlineLayer: any;
  private markersById = new Map<string, any>();

  // CartoDB raster tiles — light (Voyager) y oscuro (Dark Matter).
  private static readonly TILES = {
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  };

  // Límite de paneo + carga de tiles (región): el mapa nunca pide tiles del
  // resto del mundo → más ligero y rápido. Incluye mar Caribe al norte.
  private static readonly MAX_BOUNDS: [[number, number], [number, number]] = [
    [0.0, -75.0],   // SW
    [16.5, -57.0],  // NE (mar Caribe)
  ];

  // Vista inicial: centro y zoom con que arranca el mapa (zona afectada:
  // Caracas / La Guaira / Yumare, con algo de Caribe arriba). El zoom inicial
  // es además el MÍNIMO: no se puede alejar más → nunca quedan espacios vacíos.
  private static readonly INITIAL_CENTER: [number, number] = [10.2, -67.0];
  private static readonly INITIAL_ZOOM = 8;

  constructor() {
    // Rebuild markers whenever the data changes.
    effect(() => {
      const people = this.data.people();
      const centers = this.data.centers();
      const quakes = this.data.quakes();
      if (this.map) this.renderMarkers(people, centers, quakes);
    });

    // Swap the basemap when the theme toggles.
    effect(() => {
      const theme = this.ui.theme();
      if (this.map) {
        this.applyTiles(theme);
        this.outlineLayer?.setStyle(this.outlineStyle());
      }
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
      preferCanvas: true,
      // El zoom inicial es el mínimo: no se puede alejar (sin huecos vacíos),
      // solo acercar. El paneo se acota a la región (Venezuela + Caribe).
      minZoom: CrisisMapComponent.INITIAL_ZOOM,
      maxZoom: 19,
      maxBounds: L.latLngBounds(CrisisMapComponent.MAX_BOUNDS),
      maxBoundsViscosity: 1.0,
    });

    // Basemap matches the active theme (light Voyager / dark Dark Matter).
    this.applyTiles(this.ui.theme());

    // Contorno de Venezuela (capa visual; queda debajo de los marcadores).
    this.drawOutline();

    // Epicentros debajo, pines de personas/centros encima (clicables).
    this.quakesLayer = L.layerGroup().addTo(this.map);
    
    // Configuración de Agrupación (Clusters)
    const clusterOptions = {
      maxClusterRadius: 55,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        let missing = 0;
        let safe = 0;
        let isCenter = false;
        
        for (const m of markers) {
          if (m.options.omniType === 'center') isCenter = true;
          if (m.options.omniStatus === 'desaparecido') missing++;
          else if (m.options.omniStatus === 'a_salvo') safe++;
        }
        
        let cls = 'bg-white/90 text-gray-800 border-black/10 shadow-[0_4px_12px_rgba(0,0,0,0.15)]';
        
        if (!isCenter && (missing > 0 || safe > 0)) {
          const isMissingMajority = missing >= safe;
          cls = isMissingMajority
            ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30 shadow-none'
            : 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30 shadow-none';
        }

        return L.divIcon({
          html: `<div class="flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md border-[0.5px] font-bold text-[14px] transform transition-transform hover:scale-110 ${cls}">
                   ${count}
                 </div>`,
          className: 'omni-cluster-icon',
          iconSize: [40, 40]
        });
      }
    };

    const LAny = L as any;
    this.peopleLayer = LAny.markerClusterGroup ? LAny.markerClusterGroup(clusterOptions).addTo(this.map) : L.layerGroup().addTo(this.map);
    this.centersLayer = L.layerGroup().addTo(this.map);

    // this.drawHighlightZones();
    this.frameVenezuela();

    // Movimiento solo al hacer zoom-in: en el zoom mínimo el mapa queda fijo;
    // al acercar se habilita el arrastre. (Re-evaluado en cada cambio de zoom.)
    this.map.on('zoomend', () => this.syncDragByZoom());
    this.syncDragByZoom();

    this.renderMarkers(this.data.people(), this.data.centers(), this.data.quakes());

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
    // Vista inicial fija (centro + zoom). A este zoom (el mínimo) la vista
    // siempre cabe dentro de la región con tiles → llena la pantalla sin huecos.
    this.map.setView(
      CrisisMapComponent.INITIAL_CENTER,
      CrisisMapComponent.INITIAL_ZOOM,
      { animate: false },
    );
  }

  /**
   * Habilita el arrastre solo cuando hay zoom-in respecto al zoom mínimo. En el
   * zoom inicial/mínimo el mapa queda fijo (sin paneo).
   */
  private syncDragByZoom(): void {
    const atFloor = this.map.getZoom() <= this.map.getMinZoom();
    if (atFloor) {
      this.map.dragging.disable();
      this.map.keyboard.disable();
    } else {
      this.map.dragging.enable();
      this.map.keyboard.enable();
    }
  }

  // --- Contorno de Venezuela (capa visual local, ~22 KB) --------------------
  private drawOutline(): void {
    this.outlineLayer = L.geoJSON(VENEZUELA_OUTLINE, {
      interactive: false,            // no roba clics a los marcadores
      style: () => this.outlineStyle(),
      pane: 'overlayPane',           // sobre los tiles, debajo de los marcadores
    }).addTo(this.map);
  }

  /** Estilo del contorno según el tema (trazo sutil, sin relleno). */
  private outlineStyle(): any {
    const dark = this.ui.theme() === 'dark';
    return {
      color: dark ? '#94a3b8' : '#475569',
      weight: 1,
      opacity: dark ? 0.55 : 0.5,
      fill: false,
    };
  }

  // --- Basemap (swaps with the theme) ---------------------------------------
  private applyTiles(theme: 'light' | 'dark'): void {
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    this.tileLayer = L.tileLayer(CrisisMapComponent.TILES[theme], {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
      maxNativeZoom: 16,
      updateWhenZooming: false,
      keepBuffer: 4,
      // No solicita tiles fuera de la región (Venezuela + Caribe).
      bounds: L.latLngBounds(CrisisMapComponent.MAX_BOUNDS),
    });
    this.tileLayer.addTo(this.map);
    // Keep the basemap below markers/popups.
    this.tileLayer.bringToBack();
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
  private renderMarkers(people: PersonReport[], centers: ReliefCenter[], quakes: Quake[] = []): void {
    this.peopleLayer.clearLayers();
    this.centersLayer.clearLayers();
    this.quakesLayer.clearLayers();
    this.markersById.clear();

    // Epicentros de sismos (datos del endpoint /sismos).
    // El mapa solo muestra los de la crisis actual (desde CRISIS_SINCE);
    // el histórico (botón Sismos) los muestra todos.
    const crisisQuakes = quakes.filter((q) => new Date(q.ocurrido_en) >= CRISIS_SINCE);
    // Los DOS de mayor magnitud se resaltan: marcador más grande + etiqueta fija.
    const topQuakeIds = new Set(
      [...crisisQuakes].sort((a, b) => b.magnitud - a.magnitud).slice(0, 2).map((q) => q.id)
    );
    for (const q of crisisQuakes) {
      const isMajor = topQuakeIds.has(q.id);
      const base = Math.round(12 + Math.min(q.magnitud, 8) * 2); // 12–28px según magnitud
      const size = isMajor ? base + 10 : base;
      const cls = isMajor ? 'omni-quake omni-quake--major' : 'omni-quake';

      // Área aproximada afectada (radio según magnitud).
      L.circle([q.lat, q.lng], {
        radius: this.quakeRadiusKm(q.magnitud) * 1000,
        color: isMajor ? '#ef4444' : '#f59e0b',
        weight: 1,
        opacity: 0.5,
        fillColor: isMajor ? '#ef4444' : '#f59e0b',
        fillOpacity: isMajor ? 0.1 : 0.07,
        interactive: false
      }).addTo(this.quakesLayer);

      const marker = L.marker([q.lat, q.lng], {
        zIndexOffset: isMajor ? 1000 : 0,
        icon: L.divIcon({
          className: '',
          html: `<div class="${cls}" style="width:${size}px;height:${size}px"><span class="omni-quake-mag">${q.magnitud.toFixed(1)}</span></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      }).bindPopup(this.quakePopup(q), { maxWidth: 280 });
      if (isMajor) {
        marker.bindTooltip(
          `M${q.magnitud.toFixed(1)} · ${this.esc(q.epicentro)}`,
          { permanent: true, direction: 'top', className: 'omni-quake-label', offset: [0, -size / 2] }
        );
      }
      marker.addTo(this.quakesLayer);
      this.markersById.set(q.id, marker);
    }

    for (const p of people) {
      const isMissing = p.estado === 'desaparecido';
      const cls = isMissing
        ? 'omni-pin omni-pin--alert omni-pin--pulse'
        : p.estado === 'a_salvo' ? 'omni-pin omni-pin--safe' : 'omni-pin';
      const marker = L.marker([p.lat, p.lng], {
        omniStatus: p.estado,
        icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
      }).bindPopup(this.personPopup(p), { maxWidth: 280 });
      marker.addTo(this.peopleLayer);
      this.markersById.set(p.id, marker);
    }

    for (const c of centers) {
      const emoji = c.tipo === 'hospital' ? '🏥' : c.tipo === 'refugio' ? '🏠' : '📦';
      const marker = L.marker([c.lat, c.lng], {
        omniType: 'center',
        icon: L.divIcon({
          className: '',
          html: `<div class="omni-site omni-site--${c.tipo}">${emoji}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      }).bindPopup(this.centerPopup(c), { maxWidth: 280 });
      marker.addTo(this.centersLayer);
      this.markersById.set(c.id, marker);
    }
  }

  // --- Popups (themed via .omni-pop classes; content escaped vs. XSS) -------
  private personPopup(p: PersonReport): string {
    const dot = p.estado === 'a_salvo' ? 'var(--c-safe)' : p.estado === 'desaparecido' ? 'var(--c-alert)' : '#94a3b8';
    const imgHtml = p.foto_url ? `<img src="${this.esc(p.foto_url)}" alt="" />` : '';
    return `
      <div class="omni-pop">
        ${imgHtml}
        <div class="head">
          <span class="sdot" style="background:${dot}"></span>
          <strong>${this.esc(p.nombre)}</strong>
        </div>
        <div class="row">Cédula: <b>${this.esc(p.cedula ?? 'N/D')}</b></div>
        <div class="row">Estado: <b>${STATUS_LABEL[p.estado]}</b></div>
        ${p.telefono_contacto ? `<div class="row">📞 Contacto: <b>${this.esc(p.telefono_contacto)}</b></div>` : ''}
        <div class="row">Última ubicación: <b>${this.esc(p.ubicacion)}</b></div>
        <div class="row">Reporte: <b>${this.fmt(p.created_at)}</b></div>
        <div class="row">Fuente: <b>${SOURCE_LABEL[p.fuente]}</b></div>
        ${p.veces_reportado > 1 ? `<div class="flag">⚑ Confirmado por ${p.veces_reportado} fuentes</div>` : ''}
      </div>`;
  }

  private centerPopup(c: ReliefCenter): string {
    const kind = c.tipo === 'hospital' ? 'Hospital' : c.tipo === 'refugio' ? 'Refugio' : 'Centro de acopio';
    const color = c.tipo === 'hospital' ? 'var(--c-alert)' : c.tipo === 'refugio' ? 'var(--c-safe)' : 'var(--c-info)';
    const supplies = c.insumos_solicitados.length
      ? c.insumos_solicitados.map((s) => this.esc(s)).join(', ') : '—';
    const peopleCount = (c.tipo === 'hospital' || c.tipo === 'refugio')
      ? this.data.people().filter((p) => p.centro_id === c.id).length : 0;
    return `
      <div class="omni-pop">
        <div class="head">
          <span class="sdot" style="background:${color}"></span>
          <strong>${this.esc(c.nombre)}</strong>
        </div>
        <div class="kind" style="color:${color}">${kind}</div>
        <div class="row">Ubicación: <b>${this.esc(c.ubicacion)}</b></div>
        ${(c.tipo === 'hospital' || c.tipo === 'refugio')
          ? `<div class="row">Personas: <b>${peopleCount}</b></div>`
          : `<div class="row">Insumos: <b>${supplies}</b></div>`}
        ${c.responsable ? `<div class="row">Responsable: <b>${this.esc(c.responsable)}</b></div>` : ''}
        ${c.contacto ? `<div class="row">📞 Contacto: <b>${this.esc(c.contacto)}</b></div>` : ''}
      </div>`;
  }

  private quakePopup(q: Quake): string {
    return `
      <div class="omni-pop">
        <div class="head">
          <span class="sdot" style="background:var(--c-warn)"></span>
          <strong>Sismo · M ${q.magnitud.toFixed(1)}</strong>
        </div>
        <div class="kind" style="color:var(--c-warn)">Epicentro</div>
        <div class="row">Epicentro: <b>${this.esc(q.epicentro)}</b></div>
        <div class="row">Profundidad: <b>${q.profundidad_km} km</b></div>
        <div class="row">Área aprox.: <b>~${Math.round(this.quakeRadiusKm(q.magnitud))} km de radio</b></div>
        <div class="row">Ocurrido: <b>${this.fmt(q.ocurrido_en)}</b></div>
        <div class="row">Fuente: <b>${this.esc(q.fuente)}</b></div>
      </div>`;
  }

  /**
   * Radio aproximado (km) del área percibida/afectada según la magnitud.
   * Es una aproximación visual (crece exponencialmente con M), no un cálculo
   * sismológico exacto.
   */
  private quakeRadiusKm(mag: number): number {
    return Math.max(2, Math.pow(10, 0.43 * mag - 1.0));
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
