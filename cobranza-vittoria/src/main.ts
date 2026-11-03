import { bootstrapApplication } from '@angular/platform-browser';
import { configuracionAplicacion } from './configuracion-aplicacion';
import { Aplicacion } from './aplicacion';

bootstrapApplication(Aplicacion, configuracionAplicacion).catch((err) => console.error(err));
