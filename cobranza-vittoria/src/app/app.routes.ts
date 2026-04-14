import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { EspecialidadesPage } from './pages/especialidades/especialidades.page';
import { ProveedoresPage } from './pages/proveedores/proveedores.page';
import { MaterialesPage } from './pages/materiales/materiales.page';
import { ProyectosPage } from './pages/proyectos/proyectos.page';
import { UsuariosPage } from './pages/usuarios/usuarios.page';
import { RolesPage } from './pages/roles/roles.page';
import { UnidadesMedidaPage } from './pages/unidades-medida/unidades-medida.page';
import { RequerimientosPage } from './pages/requerimientos/requerimientos.page';
import { OrdenesCompraPage } from './pages/ordenes-compra/ordenes-compra.page';
import { ComprasPage } from './pages/compras/compras.page';
import { KardexPage } from './pages/kardex/kardex.page';
import { ValorizacionesPage } from './pages/valorizaciones/valorizaciones.page';
import { CategoriasGastoPage } from './pages/categorias-gasto/categorias-gasto.page';
import { ProveedoresGastoPage } from './pages/proveedores-gasto/proveedores-gasto.page';
import { GastosAdministrativosPage } from './pages/gastos-administrativos/gastos-administrativos.page';
import { ResumenTotalPage } from './pages/resumen-total/resumen-total.page';
import { LoginPage } from './pages/login/login.page';
import { PresupuestoPage } from './pages/presupuesto/presupuesto.page';
import { TerrenoPage } from './pages/terreno/terreno.page';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard] },
  { path: 'resumen-total', canActivate: [authGuard], component: ResumenTotalPage },
  { path: 'presupuesto', canActivate: [authGuard], component: PresupuestoPage },
  { path: 'terreno', canActivate: [authGuard], component: TerrenoPage },
  { path: 'especialidades', canActivate: [authGuard], component: EspecialidadesPage },
  { path: 'proveedores', canActivate: [authGuard], component: ProveedoresPage },
  { path: 'materiales', canActivate: [authGuard], component: MaterialesPage },
  { path: 'proyectos', canActivate: [authGuard], component: ProyectosPage },
  { path: 'usuarios', canActivate: [authGuard], component: UsuariosPage },
  { path: 'roles', canActivate: [authGuard], component: RolesPage },
  { path: 'unidades-medida', canActivate: [authGuard], component: UnidadesMedidaPage },
  { path: 'requerimientos', canActivate: [authGuard], component: RequerimientosPage },
  { path: 'ordenes-compra', canActivate: [authGuard], component: OrdenesCompraPage },
  { path: 'compras', canActivate: [authGuard], component: ComprasPage },
  { path: 'kardex', canActivate: [authGuard], component: KardexPage },
  { path: 'valorizaciones', canActivate: [authGuard], component: ValorizacionesPage },
  { path: 'proveedores-gasto', canActivate: [authGuard], component: ProveedoresGastoPage },
  { path: 'categorias-gasto', canActivate: [authGuard], component: CategoriasGastoPage },
  { path: 'gastos-administrativos', canActivate: [authGuard], component: GastosAdministrativosPage },
  { path: '**', redirectTo: 'dashboard' }
];
