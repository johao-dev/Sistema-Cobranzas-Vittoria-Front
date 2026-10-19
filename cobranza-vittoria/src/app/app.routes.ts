import { Routes } from '@angular/router';
import { UsuariosPage } from './pages/usuarios/usuarios.page';
import { RolesPage } from './pages/roles/roles.page';
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
import { PresupuestoPage } from './pages/presupuesto/presupuesto.page';
import { ProveedoresTerrenoPage } from './pages/proveedores-terreno/proveedores-terreno.page';
import { GastosSeccionPage } from './pages/gastos-seccion/gastos-seccion.page';
import { protegerRuta } from '../core/sesion/proteger-ruta';
import { PermisosPage } from './pages/permisos/permisos.page';
import { ACCESS_RULES } from './reglas-acceso';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('../autenticacion/inicio-sesion').then(m => m.InicioSesion) },
  { path: 'dashboard', loadComponent: () => import('../dashboard/resumen-compras/resumen-compras').then(m => m.ResumenCompras), canActivate: [protegerRuta] },
  { path: 'presupuesto', canActivate: [protegerRuta], component: PresupuestoPage },
  // Operaciones → Gastos del proyecto: cada vista declara únicamente sus categorías descriptivas.
  { path: 'gastos-administrativos', canActivate: [protegerRuta], component: GastosSeccionPage, data: { codigosCategoria: ['ADMINISTRATIVO'], permiteSeleccionCategoria: false, titulo: 'Gastos administrativos', subtitulo: 'Gastos de oficina y áreas de la empresa: alquiler, servicios, planilla y bancos.' } },
  { path: 'terreno', canActivate: [protegerRuta], component: GastosSeccionPage, data: { codigosCategoria: ['TERRENO', 'ANTEPROYECTO', 'PROYECTO'], permiteSeleccionCategoria: true, titulo: 'Terreno - Anteproyecto - Proyecto', subtitulo: 'Compra de terreno, alcabala, estudios previos y desarrollo del proyecto.' } },
  { path: 'marketing-publicidad', canActivate: [protegerRuta], component: GastosSeccionPage, data: { codigosCategoria: ['MARKETING_VENTAS'], permiteSeleccionCategoria: false, titulo: 'Marketing / Ventas', subtitulo: 'Publicidad, marketing, comisiones por ventas y sala de ventas.' } },
  { path: 'otros-gastos', canActivate: [protegerRuta], component: GastosSeccionPage, data: { codigosCategoria: ['OTROS'], permiteSeleccionCategoria: false, titulo: 'Otros gastos', subtitulo: 'Gastos del proyecto que no pertenecen a otra categoría.' } },
  { path: 'gastos-municipales-distritales', canActivate: [protegerRuta], component: GastosSeccionPage, data: { codigosCategoria: ['MUNICIPAL'], permiteSeleccionCategoria: false, titulo: 'Gastos municipales y distritales', subtitulo: 'Licencias, independización, declaratoria de fábrica, conformidad de obra e instalaciones.' } },
  { path: 'especialidades', canActivate: [protegerRuta], loadComponent: () => import('../catalogos/especialidades/lista-especialidades/lista-especialidades').then(m => m.ListaEspecialidades) },
  { path: 'proveedores', canActivate: [protegerRuta], loadComponent: () => import('../catalogos/proveedores/lista-proveedores/lista-proveedores').then(m => m.ListaProveedores) },
  { path: 'materiales', canActivate: [protegerRuta], loadComponent: () => import('../catalogos/materiales/lista-materiales/lista-materiales').then(m => m.ListaMateriales) },
  { path: 'proyectos', canActivate: [protegerRuta], loadComponent: () => import('../catalogos/proyectos/lista-proyectos/lista-proyectos').then(m => m.ListaProyectos) },
  { path: 'unidades-medida', canActivate: [protegerRuta], loadComponent: () => import('../catalogos/unidades-medida/lista-unidades-medida/lista-unidades-medida').then(m => m.ListaUnidadesMedida) },
  {
    path: 'requerimientos',
    canActivate: [protegerRuta],
    component: RequerimientosPage,
    data: { access: ACCESS_RULES.requerimientos }
  },
  { path: 'ordenes-compra', canActivate: [protegerRuta], component: OrdenesCompraPage },
  { path: 'compras', canActivate: [protegerRuta], component: ComprasPage },
  { path: 'kardex', canActivate: [protegerRuta], component: KardexPage },
  {
    path: 'inventario',
    canActivate: [protegerRuta],
    children: [
      { path: '', redirectTo: 'kardex-entradas', pathMatch: 'full' },
      { path: 'kardex-entradas', component: KardexEntradasPage },
      { path: 'kardex-salidas', component: KardexSalidasPage },
      { path: 'stock-actual', component: StockActualPage }
    ]
  },
  {
    path: 'control-accesos',
    canActivate: [protegerRuta],
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
    canActivate: [protegerRuta],
    data: { access: ACCESS_RULES.controlPresupuestario },
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      {
        path: 'panel',
        canActivate: [protegerRuta],
        loadComponent: () => import('./pages/control-presupuestario/control-presupuestario.page')
          .then(m => m.ControlPresupuestarioPage),
        data: { access: ACCESS_RULES.controlPresupuestarioReportes }
      },
      {
        path: 'presupuestos',
        canActivate: [protegerRuta],
        loadComponent: () => import('./pages/presupuestos/presupuestos.page').then(m => m.PresupuestosPage),
        data: { access: ACCESS_RULES.controlPresupuestarioPresupuestos }
      },
      // Gasto directo vive en Operaciones → Gastos del proyecto.
      { path: 'gastos-directos', redirectTo: '/gastos-administrativos', pathMatch: 'full' },
      {
        path: 'centros-costo',
        canActivate: [protegerRuta],
        loadComponent: () => import('./pages/centros-costo/centros-costo.page').then(m => m.CentrosCostoPage),
        data: { access: ACCESS_RULES.controlPresupuestarioCentrosCosto }
      },
      {
        path: 'partidas',
        canActivate: [protegerRuta],
        loadComponent: () => import('./pages/partidas/partidas.page').then(m => m.PartidasPage),
        data: { access: ACCESS_RULES.controlPresupuestarioPartidas }
      }
    ]
  },
  { path: 'valorizaciones', canActivate: [protegerRuta], component: ValorizacionesPage },
  { path: 'proveedores-gasto', canActivate: [protegerRuta], component: ProveedoresGastoPage },
  { path: 'proveedores-terreno', canActivate: [protegerRuta], component: ProveedoresTerrenoPage },
  { path: 'categorias-gasto', canActivate: [protegerRuta], component: CategoriasGastoPage },
  { path: '**', redirectTo: 'dashboard' }
];
