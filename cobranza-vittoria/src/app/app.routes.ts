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
import { KardexEntradasPage } from './pages/kardex-entradas/kardex-entradas.page';
import { KardexSalidasPage } from './pages/kardex-salidas/kardex-salidas.page';
import { StockActualPage } from './pages/stock-actual/stock-actual.page';
import { ValorizacionesPage } from './pages/valorizaciones/valorizaciones.page';
import { CategoriasGastoPage } from './pages/categorias-gasto/categorias-gasto.page';
import { ProveedoresGastoPage } from './pages/proveedores-gasto/proveedores-gasto.page';
import { ResumenTotalPage } from './pages/resumen-total/resumen-total.page';
import { LoginPage } from './pages/login/login.page';
import { PresupuestoPage } from './pages/presupuesto/presupuesto.page';
import { ProveedoresTerrenoPage } from './pages/proveedores-terreno/proveedores-terreno.page';
import { GastosSeccionPage } from './pages/gastos-seccion/gastos-seccion.page';
import { authGuard } from './core/guards/auth.guard';
import { PermisosPage } from './pages/permisos/permisos.page';
import { ACCESS_RULES } from './core/auth/access-control.util';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginPage },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard] },
  { path: 'resumen-total', canActivate: [authGuard], component: ResumenTotalPage },
  { path: 'presupuesto', canActivate: [authGuard], component: PresupuestoPage },
  // Operaciones → Gastos del proyecto: las cinco secciones son gasto directo filtrado por sección.
  { path: 'gastos-administrativos', canActivate: [authGuard], component: GastosSeccionPage, data: { seccion: 'ADMINISTRATIVO', titulo: 'Gastos administrativos', subtitulo: 'Gastos de oficina y áreas de la empresa: alquiler, servicios, planilla y bancos.' } },
  { path: 'terreno', canActivate: [authGuard], component: GastosSeccionPage, data: { seccion: 'TERRENO', titulo: 'Terreno - Anteproyecto - Proyecto', subtitulo: 'Compra de terreno, alcabala, estudios previos y desarrollo del proyecto.' } },
  { path: 'marketing-publicidad', canActivate: [authGuard], component: GastosSeccionPage, data: { seccion: 'MARKETING_VENTAS', titulo: 'Marketing / Ventas', subtitulo: 'Publicidad, marketing, comisiones por ventas y sala de ventas.' } },
  { path: 'otros-gastos', canActivate: [authGuard], component: GastosSeccionPage, data: { seccion: 'OTROS', titulo: 'Otros gastos', subtitulo: 'Gastos del proyecto que no pertenecen a otra sección.' } },
  { path: 'gastos-municipales-distritales', canActivate: [authGuard], component: GastosSeccionPage, data: { seccion: 'MUNICIPAL', titulo: 'Gastos municipales y distritales', subtitulo: 'Licencias, independización, declaratoria de fábrica, conformidad de obra e instalaciones.' } },
  { path: 'especialidades', canActivate: [authGuard], component: EspecialidadesPage },
  { path: 'proveedores', canActivate: [authGuard], component: ProveedoresPage },
  { path: 'materiales', canActivate: [authGuard], component: MaterialesPage },
  { path: 'proyectos', canActivate: [authGuard], component: ProyectosPage },
  { path: 'unidades-medida', canActivate: [authGuard], component: UnidadesMedidaPage },
  {
    path: 'requerimientos',
    canActivate: [authGuard],
    component: RequerimientosPage,
    data: { access: ACCESS_RULES.requerimientos }
  },
  { path: 'ordenes-compra', canActivate: [authGuard], component: OrdenesCompraPage },
  { path: 'compras', canActivate: [authGuard], component: ComprasPage },
  { path: 'kardex', canActivate: [authGuard], component: KardexPage },
  {
    path: 'inventario',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'kardex-entradas', pathMatch: 'full' },
      { path: 'kardex-entradas', component: KardexEntradasPage },
      { path: 'kardex-salidas', component: KardexSalidasPage },
      { path: 'stock-actual', component: StockActualPage }
    ]
  },
  {
    path: 'control-accesos',
    canActivate: [authGuard],
    data: { access: ACCESS_RULES.controlAccesos },
    children: [
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
      { path: 'usuarios', component: UsuariosPage },
      { path: 'perfiles', component: RolesPage },
      { path: 'acciones', component: PermisosPage }
    ]
  },
  {
    path: 'control-presupuestario',
    canActivate: [authGuard],
    data: { access: ACCESS_RULES.controlPresupuestario },
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      {
        path: 'panel',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/control-presupuestario/control-presupuestario.page')
          .then(m => m.ControlPresupuestarioPage),
        data: { access: ACCESS_RULES.controlPresupuestarioReportes }
      },
      {
        path: 'presupuestos',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/presupuestos/presupuestos.page').then(m => m.PresupuestosPage),
        data: { access: ACCESS_RULES.controlPresupuestarioPresupuestos }
      },
      // Gasto directo ya no es una sección propia: vive en Operaciones → Gastos del proyecto.
      { path: 'gastos-directos', redirectTo: '/gastos-administrativos', pathMatch: 'full' },
      {
        path: 'centros-costo',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/centros-costo/centros-costo.page').then(m => m.CentrosCostoPage),
        data: { access: ACCESS_RULES.controlPresupuestarioCentrosCosto }
      },
      {
        path: 'partidas',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/partidas/partidas.page').then(m => m.PartidasPage),
        data: { access: ACCESS_RULES.controlPresupuestarioPartidas }
      }
    ]
  },
  { path: 'valorizaciones', canActivate: [authGuard], component: ValorizacionesPage },
  { path: 'proveedores-gasto', canActivate: [authGuard], component: ProveedoresGastoPage },
  { path: 'proveedores-terreno', canActivate: [authGuard], component: ProveedoresTerrenoPage },
  { path: 'categorias-gasto', canActivate: [authGuard], component: CategoriasGastoPage },
  { path: '**', redirectTo: 'dashboard' }
];
