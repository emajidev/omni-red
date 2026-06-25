import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

// La UI anima con CSS/Tailwind (keyframes), no con el DSL de @angular/animations,
// así que no registramos provideAnimations(): menos peso de bundle.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true })
  ]
};
