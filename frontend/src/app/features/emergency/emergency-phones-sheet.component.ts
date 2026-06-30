import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheetComponent } from '../../shared/bottom-sheet/bottom-sheet.component';
import { UiService } from '../../core/services/ui.service';

interface Contact {
  name: string;
  phone: string;
}

@Component({
  selector: 'app-emergency-phones-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet title="Contactos de Emergencia" subtitle="Protección Civil - Estado Miranda" icon="alert" accentBg="bg-alertbg text-alert" (close)="ui.close()">
      <div class="space-y-4">
        <!-- Puesto de Comando -->
        <div class="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wide">Puesto de Comando Principal</span>
            <h3 class="text-base font-black text-slate-800 dark:text-slate-100">Control y Seguimiento</h3>
          </div>
          <a href="tel:02123837441" class="rounded-xl bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-bold shadow-sm transition active:scale-95 flex items-center gap-1">
            📞 0212-3837441
          </a>
        </div>

        <!-- Municipios -->
        <div>
          <span class="text-xs font-bold text-textmuted uppercase tracking-wide px-1 block mb-2">Directorios Municipales</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1 nav-scroll">
            @for (c of contacts; track c.name) {
              <div class="rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#2a2a2a]/95 p-3 flex items-center justify-between shadow-sm hover:shadow-md transition">
                <span class="text-xs font-bold text-textmain truncate max-w-[130px]">{{ c.name }}</span>
                <a [href]="'tel:' + c.phone.replace('-', '')" class="rounded-lg bg-appbg hover:bg-black/5 dark:hover:bg-white/5 text-info px-2.5 py-1.5 text-xs font-bold ring-1 ring-black/5 dark:ring-white/5 transition flex items-center gap-1">
                  📞 {{ c.phone }}
                </a>
              </div>
            }
          </div>
        </div>

        <p class="text-center text-[10px] font-medium text-textmuted">
          💡 Toca el número de teléfono desde tu dispositivo móvil para llamar directamente.
        </p>
      </div>
    </app-bottom-sheet>
  `
})
export class EmergencyPhonesSheetComponent {
  ui = inject(UiService);

  readonly contacts: Contact[] = [
    { name: 'ACEVEDO', phone: '0424-8875168' },
    { name: 'ANDRES BELLO', phone: '0412-988382' },
    { name: 'BARUTA', phone: '0212-9416277' },
    { name: 'BRION', phone: '0424-2102580' },
    { name: 'BUROZ', phone: '0416-5180837' },
    { name: 'CARRIZAL', phone: '0414-2365178' },
    { name: 'CHACAO', phone: '0424-1206707' },
    { name: 'CRISTOBAL ROJAS', phone: '0412-3662846' },
    { name: 'EL HATILLO', phone: '0212-3117654' },
    { name: 'GUAICAIPURO', phone: '0424-1789710' },
    { name: 'INDEPENDENCIA', phone: '0414-3394535' },
    { name: 'LOS SALIAS', phone: '0424-2364445' },
    { name: 'PAEZ', phone: '0412-7009911' },
    { name: 'PAZ CASTILLO', phone: '0416-0128326' },
    { name: 'PEDRO GUAL', phone: '0424-8646228' },
    { name: 'PLAZA', phone: '0426-5651393' },
    { name: 'SIMON BOLIVAR', phone: '0412-0280018' },
    { name: 'SUCRE', phone: '0424-2241801' },
    { name: 'TOMAS LANDER', phone: '0412-3837441' },
    { name: 'URDANETA', phone: '0414-9186749' },
    { name: 'ZAMORA', phone: '0412-2042862' }
  ];
}
