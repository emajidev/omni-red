import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  OnDestroy, effect, inject, viewChild
} from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { HIGHLIGHT_ZONES } from '../../core/data/map-zones';
import { VENEZUELA_OUTLINE } from '../../core/data/ve-outline';
import { CenterType, CollapsedBuilding, ExternalMapPerson, PersonReport, Quake, ReliefCenter } from '../../core/models/models';
import {
  BUILDING_STATUS_LABEL, CRISIS_SINCE, DAMAGE_LABEL, SOURCE_LABEL, STATUS_LABEL,
  buildingStatusColor, damageColor
} from '../../core/util/labels';
import { peopleAtFacility } from '../../core/util/facility-match';

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
  private buildingsLayer: any;
  private tileLayer: any;
  private outlineLayer: any;
  private markersById = new Map<string, any>();
  private quakeMarkersById = new Map<string, any>();

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
    // Rebuild markers whenever the data — o las capas visibles — cambian.
    effect(() => {
      const people = this.data.people();
      const centers = this.data.centers();
      const buildings = this.data.edificios();
      const externos = this.data.externalMapa();
      this.ui.layers(); // dependencia: re-render al conmutar capas
      if (this.map) this.renderMarkers(people, centers, buildings, externos);
    });

    // Sismos en su PROPIA capa/efecto: así la línea de tiempo (cursor) re-pinta
    // solo los epicentros — barato y fluido — sin reconstruir personas/centros.
    effect(() => {
      const quakes = this.data.quakes();
      this.ui.layers();      // dependencia: vis.sismos
      this.ui.timelineAt();  // dependencia: mover el cursor de la línea de tiempo
      if (this.map) this.renderQuakes(quakes);
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
      if (!f || !this.map) return;

      const m = f.id ? (this.markersById.get(f.id) ?? this.quakeMarkersById.get(f.id)) : null;
      // Si el marcador está dentro de un cluster, lo revelamos (sale del cluster)
      // y abrimos su popup; si no, volamos a la coordenada y abrimos el popup.
      const grp = m
        ? [this.peopleLayer, this.centersLayer, this.buildingsLayer].find(
            (g) => g && typeof g.zoomToShowLayer === 'function' && g.hasLayer?.(m),
          )
        : null;
      if (grp) {
        grp.zoomToShowLayer(m, () => m.openPopup());
      } else {
        this.map.flyTo([f.lat, f.lng], f.zoom ?? 15, { duration: 0.8 });
        if (m) setTimeout(() => m.openPopup(), 650);
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
      // 18 es suficiente (los tiles llegan a 16-19); 30 forzaba un reescalado
      // extremo que en móvil colgaba el mapa al hacer zoom.
      maxZoom: 18,
      maxBounds: L.latLngBounds(CrisisMapComponent.MAX_BOUNDS),
      maxBoundsViscosity: 1.0,
    });

    // Botones de zoom en la esquina inferior derecha (margen de 50px vía CSS).
    this.map.zoomControl.setPosition('bottomright');

    // Basemap matches the active theme (light Voyager / dark Dark Matter).
    this.applyTiles(this.ui.theme());

    // Contorno de Venezuela (capa visual; queda debajo de los marcadores).
    this.drawOutline();

    // Epicentros debajo, pines de personas/centros encima (clicables).
    this.quakesLayer = L.layerGroup().addTo(this.map);
    
    // Configuración de Agrupación (Clusters)
    const clusterOptions = {
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      // Rendimiento en móvil con muchos marcadores: inserta los pines en lotes
      // (no congela el hilo) y solo dibuja los que están en pantalla.
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
      animate: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let cls = 'bg-white/90 text-gray-800 border-black/10 shadow-[0_4px_12px_rgba(0,0,0,0.15)]';

        // El desglose desaparecidos/encontrados recorre los marcadores hijos; en
        // clusters grandes son miles de iteraciones por icono y en cada zoom
        // (se atascaba en móvil). Solo lo calculamos en clusters pequeños.
        if (count <= 200) {
          const markers = cluster.getAllChildMarkers();
          let missing = 0;
          let safe = 0;
          let isCenter = false;
          for (const m of markers) {
            if (m.options.omniType === 'center') isCenter = true;
            if (m.options.omniStatus === 'desaparecido') missing++;
            else if (m.options.omniStatus === 'encontrado') safe++;
          }
          if (!isCenter && (missing > 0 || safe > 0)) {
            cls = missing >= safe
              ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30 shadow-none'
              : 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30 shadow-none';
          }
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

    // Cluster para SITIOS (hospitales/refugios/acopios) y EDIFICIOS: icono
    // neutro de vidrio, distinto al de personas. Cada categoría conserva su
    // propio grupo (no se mezclan entre sí; cada uno se conmuta con su capa).
    const siteClusterOptions = {
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
      animate: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md border-[0.5px] border-black/10 bg-white/90 text-gray-800 font-bold text-[13px] shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-transform hover:scale-110">${count}</div>`,
          className: 'omni-cluster-icon',
          iconSize: [36, 36],
        });
      },
    };

    const LAny = L as any;
    const makeCluster = (opts: any) =>
      (LAny.markerClusterGroup ? LAny.markerClusterGroup(opts) : L.layerGroup()).addTo(this.map);
    this.peopleLayer = makeCluster(clusterOptions);
    this.centersLayer = makeCluster(siteClusterOptions);
    this.buildingsLayer = makeCluster(siteClusterOptions);

    // this.drawHighlightZones();
    this.frameVenezuela();

    // Movimiento solo al hacer zoom-in: en el zoom mínimo el mapa queda fijo;
    // al acercar se habilita el arrastre. (Re-evaluado en cada cambio de zoom.)
    this.map.on('zoomend', () => this.syncDragByZoom());
    this.syncDragByZoom();

    // Botón "Ver personas" dentro del popup de un hospital/refugio: abre la
    // hoja del sitio con su lista de personas + buscador.
    this.map.on('popupopen', (e: any) => {
      const btn = e.popup
        ?.getElement?.()
        ?.querySelector('[data-facility-id]') as HTMLElement | null;
      if (!btn) return;
      btn.addEventListener(
        'click',
        () => {
          const id = btn.getAttribute('data-facility-id');
          const tipo = btn.getAttribute('data-facility-tipo') as CenterType;
          if (id && tipo) {
            this.map.closePopup();
            this.ui.openFacility(tipo, id);
          }
        },
        { once: true },
      );
    });

    this.renderMarkers(this.data.people(), this.data.centers(), this.data.edificios(), this.data.externalMapa());
    this.renderQuakes(this.data.quakes());

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

  // --- Markers (personas / centros / edificios) -----------------------------
  private renderMarkers(
    people: PersonReport[], centers: ReliefCenter[],
    buildings: CollapsedBuilding[] = [], externos: ExternalMapPerson[] = []
  ): void {
    this.peopleLayer.clearLayers();
    this.centersLayer.clearLayers();
    this.buildingsLayer.clearLayers();
    this.markersById.clear();

    // Capas visibles (control de mostrar/ocultar categorías).
    const vis = this.ui.layers();

    if (vis.personas) {
      for (const p of people) {
        const isMissing = p.estado === 'desaparecido';
        const cls = isMissing
          ? 'omni-pin omni-pin--alert omni-pin--pulse'
          : p.estado === 'encontrado' ? 'omni-pin omni-pin--safe' : 'omni-pin';
        const marker = L.marker([p.lat, p.lng], {
          omniStatus: p.estado,
          icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] })
        }).bindPopup(this.personPopup(p), { maxWidth: 280 });
        marker.addTo(this.peopleLayer);
        this.markersById.set(p.id, marker);
      }

      // Personas del AGREGADOR externo (geocodificadas): el mapa refleja la
      // escala real, no solo la BD local. Van al MISMO cluster (sin latido,
      // para no recargar el repintado con miles de marcadores).
      for (const e of externos) {
        if (e.lat == null || e.lng == null) continue;
        const cls = e.estado === 'desaparecido'
          ? 'omni-pin omni-pin--alert'
          : e.estado === 'encontrado' ? 'omni-pin omni-pin--safe' : 'omni-pin';
        L.marker([e.lat, e.lng], {
          omniStatus: e.estado,
          icon: L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
        }).bindPopup(this.externalMapPopup(e), { maxWidth: 260 }).addTo(this.peopleLayer);
      }
    }

    for (const c of centers) {
      // Cada tipo de sitio tiene su propia capa conmutable.
      const centerVisible = c.tipo === 'hospital' ? vis.hospitales
        : c.tipo === 'refugio' ? vis.refugios : vis.acopios;
      if (!centerVisible) continue;
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

    // Edificios afectados (estructuras dañadas / colapsadas). Halo por nivel de
    // daño; latido cuando hay personas atrapadas y el rescate sigue en curso.
    if (vis.edificios) {
      for (const b of buildings) {
        const trapped = b.personas_atrapadas > 0 && b.estado !== 'despejado';
        const cls = `omni-building omni-building--${b.nivel_dano}${trapped ? ' omni-building--trapped' : ''}`;
        const marker = L.marker([b.lat, b.lng], {
          omniType: 'building',
          icon: L.divIcon({
            className: '',
            html: `<div class="${cls}">🏚️</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        }).bindPopup(this.buildingPopup(b), { maxWidth: 280 });
        marker.addTo(this.buildingsLayer);
        this.markersById.set(b.id, marker);
      }
    }
  }

  // --- Sismos (capa propia + filtro de línea de tiempo) ---------------------
  /**
   * Pinta los epicentros de la crisis (desde {@link CRISIS_SINCE}). Si la línea
   * de tiempo está activa, solo los ocurridos HASTA `ui.timelineAt()` — así, al
   * mover la barra, los sismos se van colocando en el mapa por orden cronológico.
   */
  private renderQuakes(quakes: Quake[]): void {
    this.quakesLayer.clearLayers();
    this.quakeMarkersById.clear();

    if (!this.ui.layers().sismos) return;

    // Solo los de la crisis (desde CRISIS_SINCE) y hasta el cursor de la línea
    // de tiempo: al mover la barra los sismos se van colocando cronológicamente.
    const at = this.ui.timelineAt();
    const crisisQuakes = quakes.filter(
      (q) => new Date(q.ocurrido_en) >= CRISIS_SINCE && +new Date(q.ocurrido_en) <= at,
    );

    // Los DOS de mayor magnitud (entre los visibles) se resaltan: marcador más
    // grande + etiqueta fija.
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
      this.quakeMarkersById.set(q.id, marker);
    }
  }

  // --- Popups (themed via .omni-pop classes; content escaped vs. XSS) -------
  private personPopup(p: PersonReport): string {
    const dot = p.estado === 'encontrado' ? 'var(--c-safe)' : p.estado === 'desaparecido' ? 'var(--c-alert)' : '#94a3b8';
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

  /** Popup de una persona del agregador externo (datos mínimos). */
  private externalMapPopup(e: ExternalMapPerson): string {
    const dot = e.estado === 'encontrado' ? 'var(--c-safe)' : e.estado === 'desaparecido' ? 'var(--c-alert)' : '#94a3b8';
    const estadoLbl = e.estado === 'desaparecido' ? 'Desaparecido' : e.estado === 'encontrado' ? 'Encontrado' : 'Sin confirmar';
    return `
      <div class="omni-pop">
        <div class="head">
          <span class="sdot" style="background:${dot}"></span>
          <strong>${this.esc(e.nombre)}</strong>
        </div>
        <div class="row">Estado: <b>${estadoLbl}</b></div>
        <div class="row">Ubicación: <b>${this.esc(e.ubicacion)}</b></div>
        <div class="row">Fuente: <b>Agregador externo</b></div>
      </div>`;
  }

  private centerPopup(c: ReliefCenter): string {
    const kind = c.tipo === 'hospital' ? 'Hospital' : c.tipo === 'refugio' ? 'Refugio' : 'Centro de acopio';
    const color = c.tipo === 'hospital' ? 'var(--c-alert)' : c.tipo === 'refugio' ? 'var(--c-safe)' : 'var(--c-info)';
    const supplies = c.insumos_solicitados.length
      ? c.insumos_solicitados.map((s) => this.esc(s)).join(', ') : '—';
    // Personas del sitio por COINCIDENCIA DE NOMBRE (no por centro_id, que no
    // viene normalizado). Mismo criterio que la hoja de instalaciones.
    const peopleCount = (c.tipo === 'hospital' || c.tipo === 'refugio')
      ? peopleAtFacility(this.data.people(), c).length : 0;
    return `
      <div class="omni-pop">
        <div class="head">
          <span class="sdot" style="background:${color}"></span>
          <strong>${this.esc(c.nombre)}</strong>
        </div>
        <div class="kind" style="color:${color}">${kind}</div>
        <div class="row">Ubicación: <b>${this.esc(c.ubicacion)}</b></div>
        ${(c.tipo === 'hospital' || c.tipo === 'refugio')
          ? `<div class="row">Personas: <b>${peopleCount}</b></div>
             <button type="button" class="omni-pop-btn" data-facility-id="${this.esc(c.id)}" data-facility-tipo="${c.tipo}">Ver personas (${peopleCount})</button>`
          : `<div class="row">Insumos: <b>${supplies}</b></div>`}
        ${c.responsable ? `<div class="row">Responsable: <b>${this.esc(c.responsable)}</b></div>` : ''}
        ${c.contacto ? `<div class="row">📞 Contacto: <b>${this.esc(c.contacto)}</b></div>` : ''}
      </div>`;
  }

  private buildingPopup(b: CollapsedBuilding): string {
    const dColor = damageColor(b.nivel_dano);
    const sColor = buildingStatusColor(b.estado);
    const trapped = b.personas_atrapadas > 0 && b.estado !== 'despejado';
    return `
      <div class="omni-pop">
        <div class="head">
          <span class="sdot" style="background:${dColor}"></span>
          <strong>${this.esc(b.nombre)}</strong>
        </div>
        <div class="kind" style="color:${dColor}">${DAMAGE_LABEL[b.nivel_dano]}</div>
        <div class="row">Ubicación: <b>${this.esc(b.ubicacion)}</b></div>
        <div class="row">Estado: <b style="color:${sColor}">${BUILDING_STATUS_LABEL[b.estado]}</b></div>
        <div class="row">Personas atrapadas: <b>${b.personas_atrapadas}</b></div>
        ${b.contacto ? `<div class="row">📞 Contacto: <b>${this.esc(b.contacto)}</b></div>` : ''}
        ${trapped ? `<div class="flag">⚑ Rescate en curso · ${b.personas_atrapadas} atrapada(s)</div>` : ''}
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
