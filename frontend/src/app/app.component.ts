import { ChangeDetectionStrategy, Component, OnInit, inject, AfterViewInit, signal, computed, effect } from '@angular/core';

// ... other imports remain the same ...
import { FormsModule } from '@angular/forms';

import { CrisisMapComponent } from './features/map/crisis-map.component';
import { SearchSheetComponent } from './features/search/search-sheet.component';
import { ReportSheetComponent } from './features/report/report-sheet.component';
import { OcrSheetComponent } from './features/ocr/ocr-sheet.component';
import { CentersSheetComponent } from './features/centers/centers-sheet.component';
import { SismosSheetComponent } from './features/sismos/sismos-sheet.component';
import { TimelineBarComponent } from './features/timeline/timeline-bar.component';
import { LiteHomeComponent } from './features/lite/lite-home.component';
import { FacilitiesSheetComponent } from './features/facilities/facilities-sheet.component';
import { BuildingsSheetComponent } from './features/buildings/buildings-sheet.component';
import { ReportBuildingSheetComponent } from './features/report-building/report-building-sheet.component';
import { CountUpDirective } from './shared/count-up.directive';
import { BottomSheetComponent } from './shared/bottom-sheet/bottom-sheet.component';
import { PersonDetailSheetComponent } from './features/search/person-detail-sheet.component';
import { EmergencyPhonesSheetComponent } from './features/emergency/emergency-phones-sheet.component';

import { CrisisDataService } from './core/services/crisis-data.service';
import { MapLayer, UiService } from './core/services/ui.service';
import { ConnectionService } from './core/services/connection.service';
import { PresenceService } from './core/services/presence.service';
import { PersonReport } from './core/models/models';
import { CRISIS_SINCE, statusColor, timeAgo } from './core/util/labels';

declare var gsap: any;

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, CountUpDirective, CrisisMapComponent,
    SearchSheetComponent, ReportSheetComponent, OcrSheetComponent, CentersSheetComponent,
    SismosSheetComponent, FacilitiesSheetComponent, BuildingsSheetComponent,
    ReportBuildingSheetComponent, BottomSheetComponent, TimelineBarComponent,
    LiteHomeComponent, PersonDetailSheetComponent, EmergencyPhonesSheetComponent
  ],
  template: `
    <!-- El splash screen ha sido movido a index.html para un inicio más limpio. -->

    <!-- ===== Modal de bienvenida / aviso (se muestra al cargar, hasta aceptar) ===== -->
    @if (showIntro()) {
      <div class="intro-overlay fixed inset-0 z-[9998] flex items-center justify-center p-4"
           style="background: rgba(0,0,0,.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);"
           role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <div class="intro-card w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
             style="background: var(--sheet); color: var(--txt); border: 1px solid var(--glass-border);">

          <!-- Marca -->
          <div class="mb-5 flex items-center justify-center">
            <img src="assets/brand/logo-full.svg" alt="SomosUno Logo" class="h-9 dark:invert">
          </div>

          <div class="space-y-3 text-[13px] leading-relaxed">
            <p><b>SomosUnoVzla</b> es una plataforma de respuesta ciudadana ante la crisis del sismo. Centralizamos la búsqueda de personas para que localizar a alguien sea rápido y sencillo.</p>
            
            <details class="group cursor-pointer rounded-lg bg-black/5 p-3 dark:bg-white/5 transition-all">
              <summary class="font-bold text-[12px] uppercase tracking-wide text-[var(--c-info)] outline-none list-none flex items-center justify-between">
                <span>Ver detalles técnicos</span>
                <span class="text-lg transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div class="mt-3 space-y-3 text-[12px] opacity-90">
                <p>Es una iniciativa desarrollada por <b>estudiantes de Inteligencia Artificial</b>. Aplicamos técnicas de <b>web scraping</b>, <b>redes neuronales convolucionales (CNN)</b> y algoritmos de <b>vecinos más cercanos (k-NN)</b>.</p>
                <p>Procesos <b>ETL</b>: <b>extraemos</b> de fuentes públicas (CSV y OCR); <b>transformamos</b> (minúsculas, sin acentos), y <b>desduplicamos</b> por huella; luego <b>cargamos</b> por lotes.</p>
                <p>Buscador: coincidencia exacta, prefijo, subcadena; <b>búsqueda difusa por trigramas</b> y <b>distancia de Levenshtein</b> para tolerar errores de tipeo.</p>
              </div>
            </details>
            
            <p style="color: var(--txt-muted); font-size: 11px;">Toda la información es de <b>dominio público</b>, recopilada de fuentes abiertas.</p>
          </div>

          <!-- Aviso de responsabilidad -->
          <div class="mt-4 rounded-xl p-3 text-[12px] leading-relaxed"
               style="background: rgba(239,68,68,.10); border: 1px solid rgba(239,68,68,.30);">
            <b style="color: var(--c-alert);">Aviso de responsabilidad.</b>
            Esta es una herramienta de apoyo informativo. Ante una emergencia, contacta <b>siempre</b> a los organismos oficiales de protección civil y rescate.
          </div>

          <button (click)="acceptIntro()"
                  class="mt-5 w-full rounded-xl py-2.5 text-sm font-bold text-white transition active:scale-[.98]"
                  style="background: var(--c-info);">
            Aceptar
          </button>
        </div>
      </div>
    }

    <!-- ===== Single view: the map IS the canvas (o la vista ligera) ===== -->
    <main class="relative h-[100dvh] w-full overflow-hidden">

      @if (conn.lite()) {
        <app-lite-home />
      } @else {
      <app-crisis-map></app-crisis-map>



      <!-- ===== WIDGETS FLOTANTES SUPERIORES (Z-500) ===== -->
      <div class="pointer-events-none absolute inset-x-0 top-[max(1.5rem,env(safe-area-inset-top))] md:top-[4%] z-[500] px-4">
        
        <!-- WIDGET TOP-LEFT (Logo) -->
        <div class="hidden md:flex absolute left-4 top-0 pointer-events-auto items-center gap-2 rounded-[100px] px-4 shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md h-12 border border-black/5 dark:border-white/5">
          <img src="assets/brand/isotipo.svg" alt="SomosUno" class="h-6 w-6 dark:invert">
          <span class="font-black text-lg tracking-tight hidden md:block" style="color: var(--txt);">SomosUno</span>
        </div>

        <!-- WIDGET TOP-CENTER (Buscador, Reportar/Encontrado, Filtros Múltiples) -->
        <div class="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-auto flex flex-col gap-2 w-full px-4 max-w-[95%] sm:max-w-[90%] md:max-w-[500px]">
          <!-- Búsqueda -->
          <div class="relative w-full rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md border border-black/5 dark:border-white/5 overflow-hidden transition hover:shadow-xl">
             <div class="flex items-center px-4 py-2.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition" (click)="ui.open('search')">
                <svg class="w-4 h-4 opacity-50 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <span class="text-[13px] font-semibold opacity-70">Buscar por nombre, apellido o cédula</span>
             </div>
          </div>
          
          <!-- Botones Reportar / Encontrados -->
          <div class="flex gap-2 w-full">
             <button (click)="ui.openReport('desaparecido')" class="flex-1 flex justify-center items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md shadow-lg rounded-[100px] py-2 text-[12px] font-bold border border-black/5 dark:border-white/5 transition hover:bg-black/5 active:scale-95 text-[#ef4444]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Reportar
             </button>
             <button (click)="ui.openReport('encontrado')" class="flex-1 flex justify-center items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md shadow-lg rounded-[100px] py-2 text-[12px] font-bold border border-black/5 dark:border-white/5 transition hover:bg-black/5 active:scale-95 text-[#22c55e]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                Encontrados
             </button>
          </div>

          <!-- Filtros de Capas (Múltiple) -->
          <div class="flex flex-wrap gap-2 justify-center mt-0.5">
             <!-- Todos -->
             <button (click)="ui.setAllLayers(true)" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1"
                     [style.background]="allLayersOn() ? 'var(--txt)' : 'var(--bg)'"
                     [style.color]="allLayersOn() ? 'var(--bg)' : 'var(--txt)'"
                     style="border: 1px solid var(--border);">
               Todos
             </button>
             <!-- Personas -->
             <button (click)="ui.toggleLayer('personas')" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 border border-black/5 dark:border-white/5" [style.opacity]="ui.layers()['personas'] ? '1' : '0.45'" style="color: var(--txt);">
               <span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 bg-[#ef4444]"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-[#ef4444]"></span></span> Personas
             </button>
             <!-- Hospitales -->
             <button (click)="ui.toggleLayer('hospitales')" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 border border-black/5 dark:border-white/5" [style.opacity]="ui.layers()['hospitales'] ? '1' : '0.45'" style="color: var(--txt);">
               🏥 Hospitales
             </button>
             <!-- Refugios -->
             <button (click)="ui.toggleLayer('refugios')" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 border border-black/5 dark:border-white/5" [style.opacity]="ui.layers()['refugios'] ? '1' : '0.45'" style="color: var(--txt);">
               🏠 Refugios
             </button>
             <!-- Acopio -->
             <button (click)="ui.toggleLayer('acopios')" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 border border-black/5 dark:border-white/5" [style.opacity]="ui.layers()['acopios'] ? '1' : '0.45'" style="color: var(--txt);">
               📦 Acopio
             </button>
             <!-- Edificios -->
             <button (click)="ui.toggleLayer('edificios')" class="px-3 py-1.5 rounded-[100px] text-[11px] font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 bg-white/95 dark:bg-[#2a2a2a]/95 border border-black/5 dark:border-white/5" [style.opacity]="ui.layers()['edificios'] ? '1' : '0.45'" style="color: var(--txt);">
               🏚️ Edificios
             </button>
          </div>
        </div>

        <!-- WIDGET TOP-RIGHT (Acciones + Tema + Lite) -->
        <div class="fixed md:absolute right-3 md:right-4 top-1/2 md:top-0 -translate-y-1/2 md:translate-y-0 pointer-events-auto flex flex-col md:flex-row items-end md:items-start gap-2 z-[600] md:z-auto">
           <!-- Cargar Lista (OCR) -->
           <button (click)="ui.open('ocr')" title="Cargar Lista CSV/OCR" class="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: var(--txt)">
             <svg class="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
           </button>
           
           <!-- Refugios -->
           <button (click)="ui.open('refugios')" title="Refugios" class="hidden lg:grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: var(--txt)">
             <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>
           </button>
           
           <!-- Hospitales -->
           <button (click)="ui.open('hospitales')" title="Hospitales" class="hidden lg:grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: var(--txt)">
             <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-4h8M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" /></svg>
           </button>
           
           <!-- Edificios -->
           <button (click)="ui.open('edificios')" title="Edificios" class="hidden lg:grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: var(--c-warn)">
             <svg class="h-[22px] w-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
           </button>

           <!-- Teléfonos de Emergencia -->
           <button (click)="ui.open('emergency-phones')" title="Teléfonos de Emergencia" class="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: #ef4444">
             <svg class="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
           </button>

           <!-- Theme -->
           <button (click)="ui.toggleTheme()" title="Cambiar Tema" class="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-[100px] shadow-lg bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md transition hover:bg-black/5 active:scale-90 border border-black/5 dark:border-white/5" style="color: var(--txt)">
              @if (ui.theme() === 'dark') {
                <svg class="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
              } @else {
                <svg class="h-[20px] w-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              }
           </button>
           
           <!-- Lite -->
           <button (click)="conn.toggle()" class="rounded-[100px] h-10 sm:h-12 px-3 sm:px-5 text-[11px] sm:text-[13px] font-bold text-white shadow-lg transition hover:brightness-110 active:scale-95 flex items-center border border-black/5 dark:border-white/5" [style.background]="conn.lite() ? 'var(--c-safe)' : 'var(--c-warn)'">
              {{ conn.lite() ? 'VER MAPA' : 'LITE' }}
           </button>
        </div>
      </div>

      <!-- ===== Bottom-Center Counters (Desaparecidos / Encontrados / Conectados) ===== -->
      @if (!ui.sheet()) {
        <div class="pointer-events-none absolute inset-x-0 bottom-8 z-[450] flex justify-center flex-wrap gap-2 px-4 max-w-full">
          <!-- TOTAL -->
          <div class="pointer-events-auto flex items-center gap-1.5 rounded-[100px] bg-slate-200/90 dark:bg-[#2a2a2a]/95 backdrop-blur-md px-3 py-1.5 shadow-md border border-slate-300 dark:border-white/5 transition hover:shadow-lg">
            <span class="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
            <span class="text-[13px] font-black text-slate-700 dark:text-gray-100">{{ data.metrics().total_reportados }}</span>
            <span class="text-[9px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wide">TOTAL</span>
          </div>

          <!-- Desaparecidos -->
          <div class="pointer-events-auto flex items-center gap-1.5 rounded-[100px] bg-red-100/90 dark:bg-red-900/30 backdrop-blur-md px-3 py-1.5 shadow-md border border-red-200 dark:border-red-900/50 transition hover:shadow-lg cursor-pointer" (click)="ui.openReport('desaparecido')">
            <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            <span class="text-[13px] font-black text-red-700 dark:text-red-400">{{ data.metrics().desaparecidos }}</span>
            <span class="text-[9px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wide">DESAP.</span>
          </div>
          
          <!-- Encontrados -->
          <div class="pointer-events-auto flex items-center gap-1.5 rounded-[100px] bg-green-100/90 dark:bg-green-900/30 backdrop-blur-md px-3 py-1.5 shadow-md border border-green-200 dark:border-green-900/50 transition hover:shadow-lg cursor-pointer" (click)="ui.openReport('encontrado')">
            <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            <span class="text-[13px] font-black text-green-700 dark:text-green-400">{{ data.metrics().localizados }}</span>
            <span class="text-[9px] font-bold text-green-500 dark:text-green-400 uppercase tracking-wide">ENCONTRADOS</span>
          </div>

          <!-- Acopio -->
          <div class="pointer-events-auto flex items-center gap-1.5 rounded-[100px] bg-blue-100/90 dark:bg-blue-900/30 backdrop-blur-md px-3 py-1.5 shadow-md border border-blue-200 dark:border-blue-900/50 transition hover:shadow-lg">
            <span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span class="text-[13px] font-black text-blue-700 dark:text-blue-400">{{ data.metrics().centros_activos }}</span>
            <span class="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide">ACOPIO</span>
          </div>

          <!-- Conectados / Visitas -->
          <div class="pointer-events-auto hidden md:flex items-center gap-3 rounded-[100px] bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md px-3 py-1 shadow-md border border-black/5 dark:border-white/5">
             <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visitas</span>
                <span class="text-[11px] font-black text-gray-900 dark:text-gray-100">{{ data.visitas() }}</span>
             </div>
             <div class="w-px h-3 bg-gray-200 dark:bg-gray-700"></div>
             <div class="flex items-center gap-1.5">
                <span class="text-[9px] font-bold text-green-500 uppercase tracking-wide">Online</span>
                <span class="text-[11px] font-black text-gray-900 dark:text-gray-100">{{ presence.online() }}</span>
             </div>
          </div>
        </div>
      }



      <!-- ===== Half-screen sheet host ===== -->
      }
      @switch (ui.sheet()) {
        @case ('search')  { <app-search-sheet /> }
        @case ('report')  { <app-report-sheet /> }
        @case ('ocr')     { <app-ocr-sheet /> }
        @case ('centers') { <app-centers-sheet /> }
        @case ('sismos')  { <app-sismos-sheet /> }
        @case ('refugios')   { <app-facilities-sheet tipo="refugio" /> }
        @case ('hospitales') { <app-facilities-sheet tipo="hospital" /> }
        @case ('edificios')  { <app-buildings-sheet /> }
        @case ('report-building') { <app-report-building-sheet /> }
        @case ('person-detail')   { <app-person-detail-sheet /> }
        @case ('emergency-phones') { <app-emergency-phones-sheet /> }
        @case ('menu') {
          <app-bottom-sheet (close)="ui.close()">
            <div class="px-5 py-6">
              <h2 class="text-xl font-bold mb-4">Más Opciones</h2>
              <div class="grid grid-cols-2 gap-3">
                <button (click)="ui.open('ocr')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                  <span class="text-sm font-medium">Cargar Lista</span>
                </button>
                <button (click)="ui.open('centers')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  <span class="text-sm font-medium">Acopio</span>
                </button>
                <button (click)="ui.open('refugios')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 11l9-7 9 7M5 10v10h14V10" /></svg>
                  <span class="text-sm font-medium">Refugios</span>
                </button>
                <button (click)="ui.open('hospitales')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v8m-4-4h8M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" /></svg>
                  <span class="text-sm font-medium">Hospitales</span>
                </button>
                <button (click)="ui.open('edificios')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                  <span class="text-sm font-medium">Edificios</span>
                </button>
                <button (click)="ui.open('sismos')" class="flex flex-col items-center justify-center p-4 rounded-2xl border" style="border-color: var(--divider); background: var(--surface)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h3l2-6 4 14 3-9 2 4h4" /></svg>
                  <span class="text-sm font-medium">Sismos Recientes</span>
                </button>
                <button (click)="ui.open('report-building')" class="col-span-2 flex flex-col items-center justify-center p-4 rounded-2xl text-white" style="background: linear-gradient(135deg, #f59e0b, #f97316)">
                  <svg class="h-6 w-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                  <span class="text-sm font-bold">Reportar edificio afectado</span>
                </button>
              </div>
            </div>
          </app-bottom-sheet>
        }
      }

      <!-- ===== Loading overlay ===== -->
      @if (data.loading()) {
        <div class="absolute inset-0 z-[2000] grid place-items-center" style="background: var(--bg);">
          <div class="text-center">
            <div class="mt-2 animate-pulse text-sm" style="color: var(--txt-muted);">Cargando datos…</div>
          </div>
        </div>
      }

      <!-- ===== Toasts ===== -->
      <div class="pointer-events-none absolute inset-x-0 top-24 z-[3000] flex flex-col items-center gap-2 px-3">
        @for (t of ui.toasts(); track t.id) {
          <div class="pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-card ring-1 animate-count-pop"
               [class]="toastClass(t.kind)">
            {{ t.text }}
          </div>
        }
      </div>
    </main>
  `,
  styles: [`
    .chip { display:inline-flex; align-items:center; white-space:nowrap; border-radius:9999px;
            padding:.3rem .75rem; font-weight:500; --tw-ring-inset: inset; box-shadow: 0 0 0 1px var(--tw-ring-color);
            background-color: var(--tw-bg-opacity, 1); transition: transform 0.2s; }
    .action-chip { display:flex; flex-direction:column; align-items:center; gap:.2rem;
            border-radius:1.25rem; background:#FFFFFF; padding:.75rem .25rem; font-size:.75rem;
            font-weight:600; color:#4A5568; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #EDF2F7; transition: all .2s cubic-bezier(0.4, 0, 0.2, 1); }
    .action-chip:active { transform: scale(.94); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .action-chip > :first-child { font-size:1.25rem; margin-bottom: 2px; }

    /* Botón llamativo "Versión lite": degradado ámbar→naranja con brillo pulsante. */
    .lite-cta {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      box-shadow: 0 8px 22px rgba(245, 158, 11, .45);
      animation: lite-cta-glow 2.4s ease-in-out infinite;
    }
    .lite-cta:hover { filter: brightness(1.06); }
    @keyframes lite-cta-glow {
      0%, 100% { box-shadow: 0 8px 22px rgba(245, 158, 11, .40); }
      50%      { box-shadow: 0 10px 32px rgba(249, 115, 22, .72); }
    }
    @media (prefers-reduced-motion: reduce) { .lite-cta { animation: none; } }
  `]
})
export class AppComponent implements OnInit, AfterViewInit {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  conn = inject(ConnectionService);
  presence = inject(PresenceService);



  /** Panel de capas del mapa: visible u oculto (se alterna desde la cabecera). */
  showLayers = signal(false);

  /** Qué conjunto de datos se ha cargado ya (evita descargas duplicadas). */
  private loaded: 'none' | 'lite' | 'full' = 'none';

  constructor() {
    // Carga adaptada a la conexión: en modo ligero solo las métricas (sin bajar
    // el padrón completo); en modo mapa, todo. Reacciona si se cambia de versión.
    effect(() => {
      const lite = this.conn.lite();
      // Diferido: las cargas hacen `loading.set(...)` de forma síncrona y no debe
      // ocurrir dentro de la ejecución del effect.
      if (lite) {
        if (this.loaded === 'none') { this.loaded = 'lite'; queueMicrotask(() => void this.data.loadLite()); }
      } else if (this.loaded !== 'full') {
        this.loaded = 'full';
        queueMicrotask(() => void this.data.loadAll());
      }
    });
  }

  /** Categorías conmutables que se listan en el control de capas. */
  readonly layerItems: { key: MapLayer; label: string; icon: string }[] = [
    { key: 'personas',   label: 'Personas',   icon: '👤' },
    { key: 'hospitales', label: 'Hospitales', icon: '🏥' },
    { key: 'refugios',   label: 'Refugios',   icon: '🏠' },
    { key: 'acopios',    label: 'Acopio',     icon: '📦' },
    { key: 'edificios',  label: 'Edificios',  icon: '🏚️' },
    { key: 'sismos',     label: 'Sismos',     icon: '⚡' },
  ];

  /** true si TODAS las capas están visibles (para el botón Todo/Nada). */
  readonly allLayersOn = computed(() => Object.values(this.ui.layers()).every(Boolean));

  /** Modal de bienvenida/aviso: se muestra SIEMPRE al cargar, hasta que el usuario acepta. */
  showIntro = signal(false);

  /** Cierra el modal (se vuelve a mostrar en la próxima recarga). */
  acceptIntro(): void {
    this.showIntro.set(false);
  }

  /**
   * Dos listas separadas para el panel lateral. La API ya devuelve los reportes
   * ordenados por `created_at desc` (ver PersonasService.findAll), así que
   * filtrar por estado conserva el orden de recencia. Excluimos `fallecido`.
   */
  missingPeople = computed(() =>
    this.data.people().filter((p) => p.estado === 'desaparecido').slice(0, 40)
  );
  safePeople = computed(() =>
    this.data.people().filter((p) => p.estado === 'encontrado').slice(0, 40)
  );

  /** Estado de alerta sísmica derivado de la magnitud máxima reciente (24h). */
  quakeAlert = computed(() => {
    const recent = this.data.quakes().filter(
      (q) => Date.now() - +new Date(q.ocurrido_en) < 86_400_000
    );
    const maxMag = recent.reduce((m, q) => Math.max(m, q.magnitud), 0);
    let label = 'Sin actividad';
    let color = 'var(--c-safe)';
    if (maxMag >= 5)      { label = 'Alerta alta';     color = 'var(--c-alert)'; }
    else if (maxMag >= 4) { label = 'Alerta moderada'; color = 'var(--c-warn)'; }
    else if (maxMag > 0)  { label = 'Vigilancia';      color = 'var(--c-info)'; }
    return { label, color, replicas: recent.length, maxMag };
  });

  /** Línea de noticias del ticker (se duplica en plantilla para loop continuo). */
  quakeTicker = computed(() => {
    const qs = this.data.quakes().filter((q) => new Date(q.ocurrido_en) >= CRISIS_SINCE);
    if (!qs.length) return 'Sin sismos recientes · monitoreo activo';
    return qs
      .slice(0, 8)
      .map((q) => `M${q.magnitud.toFixed(1)} · ${q.epicentro} · ${timeAgo(q.ocurrido_en)}`)
      .join(' • ');
  });

  /** Dot color for a report in the recent list. */
  dotColor(p: PersonReport): string {
    return statusColor(p.estado);
  }

  /** Relative timestamp for the recent list. */
  ago(iso: string): string {
    return timeAgo(iso);
  }

  /** Fly the map to a report when tapped in the recent list. */
  focusPerson(p: PersonReport): void {
    this.ui.focusOn({ lat: p.lat, lng: p.lng, id: p.id, zoom: 15 }, false);
  }


  ngOnInit(): void {
    // La carga de datos la dispara el efecto del constructor según la versión
    // (ligera = solo métricas; full = todo).
    this.presence.start();   // contador de usuarios conectados (latido cada 15s)
    void this.data.trackVisita();   // contador de visitas acumuladas

    // GSAP Loader transition (del index.html)
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) {
        // @ts-ignore
        gsap.to(loader, {
          opacity: 0,
          duration: 0.8,
          ease: "power2.inOut",
          onComplete: () => {
            loader.remove();
            this.showIntro.set(true); // Tras el splash, mostrar modal de bienvenida
          }
        });
      } else {
        this.showIntro.set(true);
      }
    }, 2000); // Wait 2s before fading
  }

  ngAfterViewInit(): void {
    // GSAP Stagger animations for a premium feel when loading
    setTimeout(() => {
      gsap.from(".gs-header", { opacity: 0, y: -20, duration: 0.6, ease: "power3.out" });
      gsap.from(".gs-chip", { opacity: 0, scale: 0.8, stagger: 0.05, duration: 0.4, ease: "back.out(1.5)", delay: 0.2 });
      gsap.from(".gs-nav", { opacity: 0, y: 20, duration: 0.6, ease: "power3.out", delay: 0.1 });
      gsap.from(".gs-recent", { opacity: 0, x: -20, duration: 0.5, ease: "power2.out", delay: 0.4 });
    }, 100);
  }

  toastClass(kind: string): string {
    switch (kind) {
      case 'success': return 'bg-safebg text-safe ring-safe/40';
      case 'alert':   return 'bg-alertbg text-alert ring-alert/40';
      case 'warn':    return 'bg-warnbg text-warn ring-warn/40';
      default:        return 'glass-bar ring-transparent';
    }
  }
}
