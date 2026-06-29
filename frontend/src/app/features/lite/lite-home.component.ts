import { ChangeDetectionStrategy, Component, computed, inject, AfterViewInit } from '@angular/core';
import { CrisisDataService } from '../../core/services/crisis-data.service';
import { UiService } from '../../core/services/ui.service';
import { ConnectionService } from '../../core/services/connection.service';
import { CountUpDirective } from '../../shared/count-up.directive';

/**
 * Vista LIGERA (sin mapa) para conexiones lentas o para quien prefiera lo
 * esencial: cabecera, acciones primordiales (buscar / reportar) y métricas.
 * Inspirada en una landing sobria de emergencia. Las acciones abren las mismas
 * hojas que el resto de la app (no dependen del mapa).
 */
@Component({
  selector: 'app-lite-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountUpDirective],
  templateUrl: './lite-home.component.html',
  styleUrl: './lite-home.component.css'
})
export class LiteHomeComponent implements AfterViewInit {
  data = inject(CrisisDataService);
  ui = inject(UiService);
  conn = inject(ConnectionService);

  readonly m = computed(() => this.data.metrics());

  /** Accesos a las demás hojas (todas funcionan sin mapa). */
  readonly secondary: { sheet: 'ocr' | 'sismos' | 'hospitales' | 'refugios' | 'centers' | 'edificios' | 'report-building'; icon: string; label: string; desc: string }[] = [
    { sheet: 'ocr', icon: '📤', label: 'Cargar lista', desc: 'Sube una lista de personas (CSV/Excel) y procésala con IA OCR automáticamente.' },
    { sheet: 'sismos', icon: '⚡', label: 'Sismos', desc: 'Monitoreo sísmico en tiempo real conectado directamente a la API de USGS.' },
    { sheet: 'hospitales', icon: '🏥', label: 'Hospitales', desc: 'Ubicación, capacidad y estado de recursos de los hospitales cercanos.' },
    { sheet: 'refugios', icon: '🏠', label: 'Refugios', desc: 'Zonas seguras habilitadas y centros de albergue para damnificados.' },
    { sheet: 'centers', icon: '📦', label: 'Acopio', desc: 'Centros de distribución e inventario de ayuda humanitaria disponible.' },
    { sheet: 'edificios', icon: '🏚️', label: 'Edificios', desc: 'Estado estructural e informes de daños de infraestructuras urbanas.' },
    { sheet: 'report-building', icon: '🏗️', label: 'Reportar edificio', desc: 'Levanta reportes ciudadanos sobre edificios con peligro de colapso.' },
  ];

  ngAfterViewInit() {
    // Animaciones GSAP Stagger para la versión Lite (estilo Landing)
    // @ts-ignore
    if (typeof gsap !== 'undefined') {
      // @ts-ignore
      gsap.fromTo('.navbar-wrapper', 
        { opacity: 0, y: -20, visibility: 'hidden' }, 
        { opacity: 1, y: 0, visibility: 'visible', duration: 0.8, ease: 'power3.out' }
      );
      // @ts-ignore
      gsap.fromTo('[data-gsap="hero"]', 
        { y: 40, opacity: 0, visibility: 'hidden' },
        { 
          y: 0, opacity: 1, visibility: 'visible',
          duration: 1.2, stagger: 0.2, ease: 'power3.out', delay: 0.2 
        }
      );

      // @ts-ignore
      gsap.fromTo('[data-gsap="fade"]',
        { y: 30, opacity: 0, visibility: 'hidden' },
        { 
          y: 0, opacity: 1, visibility: 'visible',
          duration: 1.2, ease: 'power3.out', delay: 0.5
        }
      );

      // @ts-ignore
      gsap.fromTo('[data-gsap="scale"]',
        { y: 20, opacity: 0, scale: 0.95, visibility: 'hidden' },
        { 
          y: 0, opacity: 1, scale: 1, visibility: 'visible',
          duration: 0.8, stagger: 0.1, ease: 'power3.out', delay: 0.7
        }
      );
    }

    // Smart Navbar scroll logic
    const liteContainer = document.querySelector('.lite-container');
    const wrapper = document.getElementById('navbarWrapper');
    const navbar = document.getElementById('navbar');

    if (liteContainer && wrapper && navbar) {
      let lastScrollY = liteContainer.scrollTop;

      liteContainer.addEventListener('scroll', () => {
        const currentScrollY = liteContainer.scrollTop;

        // Transparent at top
        if (currentScrollY <= 60) {
          navbar.classList.remove('scrolled');
          wrapper.classList.remove('nav-hidden');
        } else {
          navbar.classList.add('scrolled');

          // Smart Hide / Show
          if (currentScrollY > lastScrollY && currentScrollY > 50) {
            // Scrolling down -> Hide nav
            wrapper.classList.add('nav-hidden');
          } else if (currentScrollY < lastScrollY) {
            // Scrolling up -> Show nav
            wrapper.classList.remove('nav-hidden');
          }
        }
        lastScrollY = currentScrollY;
      });
    }
  }
}
