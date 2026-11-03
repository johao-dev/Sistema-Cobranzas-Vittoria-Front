import { Routes } from '@angular/router';
import { protegerRuta } from './core/sesion/proteger-ruta';
import { ACCESS_RULES } from './reglas-acceso';

export const rutas: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./autenticacion/inicio-sesion').then((m) => m.InicioSesion),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/resumen-compras/resumen-compras').then((m) => m.ResumenCompras),
    canActivate: [protegerRuta],
  },
  // Operaciones → Gastos del proyecto: cada vista declara únicamente sus categorías descriptivas.
  {
    path: 'gastos-administrativos',
    canActivate: [protegerRuta],
    loadComponent: () => import('./gastos/listado/gastos-seccion').then((m) => m.GastosSeccion),
    data: {
      codigosCategoria: ['ADMINISTRATIVO'],
      permiteSeleccionCategoria: false,
      titulo: 'Gastos administrativos',
      subtitulo: 'Gastos de oficina y áreas de la empresa: alquiler, servicios, planilla y bancos.',
    },
  },
  {
    path: 'terreno',
    canActivate: [protegerRuta],
    loadComponent: () => import('./gastos/listado/gastos-seccion').then((m) => m.GastosSeccion),
    data: {
      codigosCategoria: ['TERRENO', 'ANTEPROYECTO', 'PROYECTO'],
      permiteSeleccionCategoria: true,
      titulo: 'Terreno - Anteproyecto - Proyecto',
      subtitulo: 'Compra de terreno, alcabala, estudios previos y desarrollo del proyecto.',
    },
  },
  {
    path: 'marketing-publicidad',
    canActivate: [protegerRuta],
    loadComponent: () => import('./gastos/listado/gastos-seccion').then((m) => m.GastosSeccion),
    data: {
      codigosCategoria: ['MARKETING_VENTAS'],
      permiteSeleccionCategoria: false,
      titulo: 'Marketing / Ventas',
      subtitulo: 'Publicidad, marketing, comisiones por ventas y sala de ventas.',
    },
  },
  {
    path: 'otros-gastos',
    canActivate: [protegerRuta],
    loadComponent: () => import('./gastos/listado/gastos-seccion').then((m) => m.GastosSeccion),
    data: {
      codigosCategoria: ['OTROS'],
      permiteSeleccionCategoria: false,
      titulo: 'Otros gastos',
      subtitulo: 'Gastos del proyecto que no pertenecen a otra categoría.',
    },
  },
  {
    path: 'gastos-municipales-distritales',
    canActivate: [protegerRuta],
    loadComponent: () => import('./gastos/listado/gastos-seccion').then((m) => m.GastosSeccion),
    data: {
      codigosCategoria: ['MUNICIPAL'],
      permiteSeleccionCategoria: false,
      titulo: 'Gastos municipales y distritales',
      subtitulo:
        'Licencias, independización, declaratoria de fábrica, conformidad de obra e instalaciones.',
    },
  },
  {
    path: 'especialidades',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./catalogos/especialidades/lista-especialidades/lista-especialidades').then(
        (m) => m.ListaEspecialidades,
      ),
  },
  {
    path: 'proveedores',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./catalogos/proveedores/lista-proveedores/lista-proveedores').then(
        (m) => m.ListaProveedores,
      ),
  },
  {
    path: 'materiales',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./catalogos/materiales/lista-materiales/lista-materiales').then(
        (m) => m.ListaMateriales,
      ),
  },
  {
    path: 'proyectos',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./catalogos/proyectos/lista-proyectos/lista-proyectos').then((m) => m.ListaProyectos),
  },
  {
    path: 'unidades-medida',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./catalogos/unidades-medida/lista-unidades-medida/lista-unidades-medida').then(
        (m) => m.ListaUnidadesMedida,
      ),
  },
  {
    path: 'requerimientos',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./requerimientos/lista-requerimientos/lista-requerimientos').then(
        (m) => m.ListaRequerimientos,
      ),
    data: { access: ACCESS_RULES.requerimientos },
  },
  {
    path: 'ordenes-compra',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./ordenes-compra/bandeja-ordenes/bandeja-ordenes').then((m) => m.BandejaOrdenes),
  },
  {
    path: 'compras',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./compras/bandeja-compras/bandeja-compras').then((m) => m.BandejaCompras),
  },
  {
    path: 'kardex',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./inventario/kardex-compras/kardex-compras').then((m) => m.KardexCompras),
  },
  {
    path: 'inventario',
    canActivate: [protegerRuta],
    children: [
      { path: '', redirectTo: 'kardex-entradas', pathMatch: 'full' },
      {
        path: 'kardex-entradas',
        loadComponent: () =>
          import('./inventario/entradas/lista-entradas').then((m) => m.ListaEntradas),
      },
      {
        path: 'kardex-salidas',
        loadComponent: () =>
          import('./inventario/salidas/lista-salidas').then((m) => m.ListaSalidas),
      },
      {
        path: 'transferencias-proyecto',
        loadComponent: () =>
          import('./inventario/transferencias/lista-transferencias/lista-transferencias').then(
            (m) => m.ListaTransferencias,
          ),
      },
      {
        path: 'stock-actual',
        loadComponent: () => import('./inventario/stock/stock-actual').then((m) => m.StockActual),
      },
    ],
  },
  {
    path: 'control-accesos',
    canActivate: [protegerRuta],
    data: { access: ACCESS_RULES.controlAccesos },
    children: [
      { path: '', redirectTo: 'usuarios', pathMatch: 'full' },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./control-accesos/usuarios/lista-usuarios/lista-usuarios').then(
            (m) => m.ListaUsuarios,
          ),
      },
      {
        path: 'perfiles',
        loadComponent: () =>
          import('./control-accesos/roles/lista-roles/lista-roles').then((m) => m.ListaRoles),
      },
      {
        path: 'acciones',
        loadComponent: () =>
          import('./control-accesos/permisos/lista-permisos/lista-permisos').then(
            (m) => m.ListaPermisos,
          ),
      },
    ],
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
        loadComponent: () =>
          import('./presupuestos/consultas/control-presupuestario').then(
            (m) => m.ControlPresupuestario,
          ),
        data: { access: ACCESS_RULES.controlPresupuestarioReportes },
      },
      {
        path: 'presupuestos',
        canActivate: [protegerRuta],
        loadComponent: () =>
          import('./presupuestos/listado/lista-presupuestos').then((m) => m.ListaPresupuestos),
        data: { access: ACCESS_RULES.controlPresupuestarioPresupuestos },
      },
      // Gasto directo vive en Operaciones → Gastos del proyecto.
      { path: 'gastos-directos', redirectTo: '/gastos-administrativos', pathMatch: 'full' },
      {
        path: 'centros-costo',
        canActivate: [protegerRuta],
        loadComponent: () =>
          import('./presupuestos/centros-costo/lista-centros-costo').then(
            (m) => m.ListaCentrosCosto,
          ),
        data: { access: ACCESS_RULES.controlPresupuestarioCentrosCosto },
      },
      {
        path: 'partidas',
        canActivate: [protegerRuta],
        loadComponent: () =>
          import('./presupuestos/partidas/lista-partidas').then((m) => m.ListaPartidas),
        data: { access: ACCESS_RULES.controlPresupuestarioPartidas },
      },
    ],
  },
  {
    path: 'proveedores-gasto',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./gastos/proveedores-gasto/lista-proveedores-gasto').then(
        (m) => m.ListaProveedoresGasto,
      ),
  },
  {
    path: 'proveedores-terreno',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./gastos/proveedores-terreno/lista-proveedores-terreno').then(
        (m) => m.ListaProveedoresTerreno,
      ),
  },
  {
    path: 'categorias-gasto',
    canActivate: [protegerRuta],
    loadComponent: () =>
      import('./gastos/categorias/lista-categorias-gasto').then((m) => m.ListaCategoriasGasto),
  },
  { path: '**', redirectTo: 'dashboard' },
];
