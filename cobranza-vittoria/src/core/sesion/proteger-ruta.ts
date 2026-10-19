import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionUsuario } from './sesion-usuario';
import { esReglaAcceso } from './control-acceso';

export const protegerRuta: CanActivateFn = (route, state) => {
  const auth = inject(SesionUsuario);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url || '/dashboard' },
    });
  }

  const access: unknown = route.data['access'];
  if ((access === undefined || esReglaAcceso(access)) && auth.canAccess(access)) return true;

  // La ruta y el menú aplican la misma AccessRule; el backend conserva la decisión final.
  return router.createUrlTree(['/dashboard'], { queryParams: { accesoDenegado: true } });
};
