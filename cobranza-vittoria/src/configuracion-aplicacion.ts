import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { rutas } from './rutas';
import { interceptarSesion } from './core/sesion/interceptar-sesion';

export const configuracionAplicacion: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(rutas),
    provideHttpClient(withInterceptors([interceptarSesion])),
  ],
};
