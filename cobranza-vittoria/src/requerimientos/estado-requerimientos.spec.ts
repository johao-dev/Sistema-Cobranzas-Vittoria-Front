import { provideZonelessChangeDetection } from '@angular/core';
import { EstadoRequerimientos } from './estado-requerimientos';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ListaRequerimientos } from './lista-requerimientos/lista-requerimientos';
import { RegistroRequerimientos } from './registro-requerimientos';
import { CatalogoEspecialidades } from '../catalogos/especialidades/catalogo-especialidades';
import { CatalogoProyectos } from '../catalogos/proyectos/catalogo-proyectos';
import { CatalogoMateriales } from '../catalogos/materiales/catalogo-materiales';
import { CatalogoUnidadesMedida } from '../catalogos/unidades-medida/catalogo-unidades-medida';
import { ControlPresupuestarioService } from '../app/core/services/control-presupuestario.service';
import { SesionUsuario } from '../core/sesion/sesion-usuario';
import { NotificationService } from '../app/core/services/notification.service';
import {
  EstadoRequerimiento,
  RequerimientoActionResponse,
  RequerimientoGetResponse,
  RequerimientoItemResponse,
  RequerimientoResumen,
  RequerimientoCreadoResponse,
} from './contratos-requerimientos';

describe('ListaRequerimientos — gestión de ítems en almacén', () => {
  let fixture: ComponentFixture<ListaRequerimientos>;
  let page: EstadoRequerimientos;
  let detalle: RequerimientoGetResponse;
  let permisos: Set<string>;

  const persistido: RequerimientoItemResponse = {
    idRequerimientoDetalle: 710,
    idRequerimiento: 45,
    idMaterial: 93,
    cantidad: 2.5,
    idPresupuestoDetalle: 18,
    observacion: 'Original',
  };
  const api = {
    listar: vi.fn<() => Observable<RequerimientoResumen[]>>(),
    obtener: vi.fn<() => Observable<RequerimientoGetResponse>>(),
    agregarItem: vi.fn<() => Observable<RequerimientoItemResponse>>(),
    actualizarItem: vi.fn<() => Observable<RequerimientoItemResponse>>(),
    eliminarItem: vi.fn<() => Observable<void>>(),
    validarAlmacen: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    actualizar: vi.fn<() => Observable<RequerimientoActionResponse>>(),
  };
  const flujo = {
    enviar: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    aprobar: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    rechazar: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    enviarCompras: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    crear: vi.fn<() => Observable<RequerimientoCreadoResponse>>(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();

    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.open = true;
      },
    });

    permisos = new Set(['requerimientos.gestionar_items_almacen', 'requerimientos.procesar_stock']);
    detalle = {
      requerimiento: {
        idRequerimiento: 45,
        numeroRequerimiento: 'RQ-45',
        estado: 'EnviadoAlmacen',
        idProyecto: 6,
        nombreProyecto: 'Obra',
        fechaRequerimiento: '2026-10-16',
        fechaEntrega: '2026-10-20',
      },
      items: [
        {
          ...persistido,
          idEspecialidad: 4,
          especialidad: 'Estructuras',
          material: 'Cemento',
          unidadMedida: 'BOL',
          codigoPartida: '01',
          nombrePartida: 'Obra gris',
        },
      ],
      validaciones: [],
      puedeEditar: false,
    };

    const exito: RequerimientoActionResponse = { ok: true };

    [flujo.enviar, flujo.aprobar, flujo.rechazar, flujo.enviarCompras].forEach((mock) =>
      mock.mockReturnValue(of(exito)),
    );
    flujo.crear.mockReturnValue(of({ idRequerimiento: 46 }));
    api.listar.mockReturnValue(of([]));
    api.obtener.mockImplementation(() => of(structuredClone(detalle)));
    api.agregarItem.mockReturnValue(
      of({ ...persistido, idRequerimientoDetalle: 720, idMaterial: 94 }),
    );
    api.actualizarItem.mockReturnValue(of(persistido));
    api.eliminarItem.mockReturnValue(of(undefined));
    api.validarAlmacen.mockReturnValue(of({ ok: true }));
    api.actualizar.mockReturnValue(of({ ok: true }));

    await TestBed.configureTestingModule({
      imports: [ListaRequerimientos],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RegistroRequerimientos, useValue: { ...api, ...flujo } },
        {
          provide: SesionUsuario,
          useValue: { hasPermission: (permiso: string) => permisos.has(permiso) },
        },
        { provide: NotificationService, useValue: notificaciones },
        ...[
          CatalogoEspecialidades,
          CatalogoProyectos,
          CatalogoMateriales,
          CatalogoUnidadesMedida,
        ].map((provide) => ({
          provide,
          useValue: {
            especialidades: () => of([{ idEspecialidad: 4, nombre: 'Estructuras' }]),
            proyectos: () => of([]),
            unidadesMedida: () => of([]),
            materiales: () =>
              of([
                { idMaterial: 93, idEspecialidad: 4, descripcion: 'Cemento', unidadMedida: 'BOL' },
                { idMaterial: 94, idEspecialidad: 4, descripcion: 'Acero', unidadMedida: 'KG' },
              ]),
          },
        })),
        {
          provide: ControlPresupuestarioService,
          useValue: {
            partidas: () => of([]),
            centrosCosto: () => of([{ idCentroCosto: 8, idProyecto: 6 }]),
            saldos: () =>
              of([{ idPresupuestoDetalle: 18, codigoPartida: '01', partida: 'Obra gris' }]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaRequerimientos);
    page = fixture.debugElement.injector.get(EstadoRequerimientos);

    fixture.detectChanges();
    page.view({ idRequerimiento: 45 });
    page.editarDesdeDetalle();
  });

  afterEach(() => {
    vi.restoreAllMocks();

    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  });

  function abrirNuevoItem(): void {
    page.abrirModalEspecialidades();

    page.modalItem().idEspecialidad = 4;
    page.modalItem().idMaterial = 94;
    page.modalItem().cantidad = 3.25;
  }

  it.each<EstadoRequerimiento>([
    'Registrado',
    'ValidadoAlmacen',
    'AprobadoCoordinador',
    'Rechazado',
    'EnviadoOC',
    'GeneradoOC',
    'Anulado',
  ])('no habilita gestión en %s aunque exista el permiso', (estado) => {
    page.detalle()!.requerimiento.estado = estado;

    expect(page.puedeGestionarItemsAlmacen).toBe(false);

    page.abrirModalEspecialidades();
    page.agregarItemDesdeModal();
    page.removeItem(0);

    expect(page.modalEspecialidades()).toBe(false);
    expect(api.agregarItem).not.toHaveBeenCalled();
    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(api.eliminarItem).not.toHaveBeenCalled();
  });
  it('exige el permiso de gestión de ítems aunque el usuario pueda procesar stock', () => {
    permisos.clear();
    permisos.add('requerimientos.procesar_stock');

    expect(page.puedeGestionarItemsAlmacen).toBe(false);
    expect(page.puedeEditarDetalle).toBe(false);

    abrirNuevoItem();
    page.agregarItemDesdeModal();

    expect(api.agregarItem).not.toHaveBeenCalled();
  });
  it('guarda el alta sin campos de presentación y recarga etiquetas e indicadores', () => {
    abrirNuevoItem();
    detalle.items.push({
      ...persistido,
      idRequerimientoDetalle: 720,
      idMaterial: 94,
      cantidad: 3.25,
      material: 'Acero',
      especialidad: 'Estructuras',
    });

    detalle.requerimiento.especialidades = 'Estructuras';

    page.agregarItemDesdeModal();

    expect(api.agregarItem).toHaveBeenCalledWith(45, {
      idMaterial: 94,
      cantidad: 3.25,
      idPresupuestoDetalle: null,
      observacion: null,
    });
    expect(page.form().items).toHaveLength(2);
    expect(page.form().items[1].material).toBe('Acero');
    expect(page.detalle()?.requerimiento.especialidades).toBe('Estructuras');
    expect(page.modalEspecialidades()).toBe(false);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });
  it('PATCH envía únicamente la cantidad modificada y usa idRequerimientoDetalle', () => {
    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = 0.29;
    detalle.items[0].cantidad = 0.29;

    page.agregarItemDesdeModal();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, { cantidad: 0.29 });
    expect(page.form().items[0].cantidad).toBe(0.29);
    expect(page.form().items[0].material).toBe('Cemento');
    expect(api.actualizar).not.toHaveBeenCalled();
  });
  it('PATCH limpia partida y observación con null y omite cantidad sin cambios', () => {
    page.abrirModalEspecialidades(0);

    page.modalItem().idPresupuestoDetalle = null;
    page.modalItem().observacion = '';

    page.agregarItemDesdeModal();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, {
      idPresupuestoDetalle: null,
      observacion: null,
    });
  });
  it('PATCH modifica partida y observación sin incluir cantidad ni material', () => {
    page.abrirModalEspecialidades(0);

    page.modalItem().idPresupuestoDetalle = 29;
    page.modalItem().observacion = 'Nueva observación';

    page.agregarItemDesdeModal();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, {
      idPresupuestoDetalle: 29,
      observacion: 'Nueva observación',
    });
  });
  it('PATCH omite los opcionales nulos cuando solo cambia la cantidad', () => {
    page.detalle()!.items[0].observacion = null;
    page.detalle()!.items[0].idPresupuestoDetalle = null;

    page.editarDesdeDetalle();
    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = 4;

    page.agregarItemDesdeModal();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, { cantidad: 4 });
  });
  it('no envía PATCH vacío ni confunde los valores opcionales nulos con cambios', () => {
    page.detalle()!.items[0].observacion = null;
    page.detalle()!.items[0].idPresupuestoDetalle = null;

    page.editarDesdeDetalle();
    page.abrirModalEspecialidades(0);
    page.agregarItemDesdeModal();

    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(page.msg()).toBe('No hay cambios para guardar.');
  });
  it.each([null, 0, -1, NaN, Infinity, 1.001, 0.000000001])(
    'rechaza cantidad inválida %s',
    (cantidad) => {
      abrirNuevoItem();

      page.modalItem().cantidad = cantidad;

      page.agregarItemDesdeModal();

      expect(api.agregarItem).not.toHaveBeenCalled();
      expect(page.msg()).toContain('dos decimales');
    },
  );
  it('no envía cantidad null en un PATCH', () => {
    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = null;

    page.agregarItemDesdeModal();

    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(page.hayCambiosItemAlmacen).toBe(true);
  });
  it('valida observaciones de hasta 250 caracteres', () => {
    abrirNuevoItem();

    page.modalItem().observacion = 'a'.repeat(251);

    page.agregarItemDesdeModal();

    expect(api.agregarItem).not.toHaveBeenCalled();

    page.modalItem().observacion = 'a'.repeat(250);

    page.agregarItemDesdeModal();

    expect(api.agregarItem).toHaveBeenCalled();
  });
  it('impide materiales duplicados', () => {
    abrirNuevoItem();

    page.modalItem().idMaterial = 93;

    page.agregarItemDesdeModal();

    expect(page.msg()).toContain('ya existe');
    expect(api.agregarItem).not.toHaveBeenCalled();
  });
  it('exige seleccionar material y revalida el permiso al guardar', () => {
    page.abrirModalEspecialidades();
    page.agregarItemDesdeModal();

    expect(page.msg()).toContain('seleccionar un material');
    expect(api.agregarItem).not.toHaveBeenCalled();

    page.modalItem().idMaterial = 94;

    permisos.delete('requerimientos.gestionar_items_almacen');
    page.agregarItemDesdeModal();

    expect(api.agregarItem).not.toHaveBeenCalled();
  });
  it('impide sustituir el material de un ítem existente', () => {
    page.abrirModalEspecialidades(0);

    page.modalItem().idMaterial = 94;

    page.agregarItemDesdeModal();

    expect(page.msg()).toContain('no puede modificarse');
    expect(api.actualizarItem).not.toHaveBeenCalled();
  });

  it('confirma la eliminación y nunca elimina el último ítem', () => {
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true);

    page.removeItem(0);

    expect(api.eliminarItem).not.toHaveBeenCalled();
    expect(confirmacion).not.toHaveBeenCalled();

    page
      .form()
      .items.push({ ...page.form().items[0], idRequerimientoDetalle: 720, idMaterial: 94 });

    confirmacion.mockReturnValueOnce(false);

    page.removeItem(1);

    expect(api.eliminarItem).not.toHaveBeenCalled();

    page.removeItem(1);

    expect(api.eliminarItem).toHaveBeenCalledWith(45, 720);
    expect(page.form().items).toHaveLength(1);
    expect(page.guardandoItem()).toBe(false);
  });
  it('recupera los ítems si otro usuario dejó solo el último antes del DELETE', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    page
      .form()
      .items.push({ ...page.form().items[0], idRequerimientoDetalle: 720, idMaterial: 94 });

    api.eliminarItem.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'No se puede eliminar el último ítem' },
          }),
      ),
    );

    page.removeItem(0);

    expect(api.eliminarItem).toHaveBeenCalledWith(45, 710);
    expect(page.form().items).toHaveLength(1);
    expect(page.form().items[0].idRequerimientoDetalle).toBe(710);
    expect(notificaciones.show).toHaveBeenCalledWith(
      expect.stringContaining('último ítem'),
      'error',
    );
  });
  it('bloquea doble envío, cierre y validación durante una escritura y su recarga', () => {
    const escritura = new Subject<RequerimientoItemResponse>();
    const lectura = new Subject<RequerimientoGetResponse>();

    api.agregarItem.mockReturnValue(escritura);
    api.obtener.mockReturnValue(lectura);

    abrirNuevoItem();
    page.agregarItemDesdeModal();
    page.agregarItemDesdeModal();
    page.cerrarFormModal();
    page.abrirAccion('validar-almacen');

    expect(api.agregarItem).toHaveBeenCalledTimes(1);
    expect(page.formModalOpen()).toBe(true);
    expect(page.accionModalOpen()).toBe(false);

    escritura.next({ ...persistido, idRequerimientoDetalle: 720, idMaterial: 94 });

    escritura.complete();

    expect(page.recargandoItems()).toBe(true);
    expect(page.form().items[1].material).toBe('Acero');

    page.abrirAccion('validar-almacen');

    expect(page.accionModalOpen()).toBe(false);

    lectura.next(detalle);

    lectura.complete();

    expect(page.recargandoItems()).toBe(false);

    page.cerrarFormModal();
    page.abrirAccion('validar-almacen');
    page.ejecutarAccion();

    expect(api.validarAlmacen).toHaveBeenCalledWith(45, {
      resultado: 'Conforme',
      observacion: null,
    });
  });
  it('exige resolver la edición antes de validar y confirma el descarte', () => {
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(false);

    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = 9;

    page.abrirAccion('validar-almacen');

    expect(page.accionModalOpen()).toBe(false);

    page.accionActual.set('validar-almacen');

    page.ejecutarAccion();

    expect(api.validarAlmacen).not.toHaveBeenCalled();

    page.cerrarFormModal();

    expect(page.modalEspecialidades()).toBe(true);

    confirmacion.mockReturnValue(true);

    page.cerrarFormModal();

    expect(page.modalEspecialidades()).toBe(false);
    expect(page.detalleModalOpen()).toBe(true);
    expect(page.detalle()?.items[0].cantidad).toBe(2.5);
  });
  it.each([400, 401, 403])('presenta el error %i sin cambiar el detalle persistido', (status) => {
    api.actualizarItem.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status,
            error: { message: 'Operación rechazada' },
          }),
      ),
    );

    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = 6;

    page.agregarItemDesdeModal();

    expect(page.guardandoItem()).toBe(false);
    expect(page.detalle()?.items[0].cantidad).toBe(2.5);
    expect(page.modalEspecialidades()).toBe(true);
    expect(notificaciones.show).toHaveBeenCalledWith(
      expect.stringContaining('Operación rechazada'),
      'error',
    );
  });
  it.each([404, 409])(
    'ante %i recarga cambios concurrentes y retira acciones si cambió el estado',
    (status) => {
      api.actualizarItem.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status,
              error: { message: 'El requerimiento cambió' },
            }),
        ),
      );

      page.abrirModalEspecialidades(0);

      page.modalItem().cantidad = 6;
      detalle.requerimiento.estado = 'ValidadoAlmacen';
      detalle.items[0].cantidad = 8;

      page.agregarItemDesdeModal();

      expect(page.form().items[0].cantidad).toBe(8);
      expect(page.modalEspecialidades()).toBe(false);
      expect(page.puedeGestionarItemsAlmacen).toBe(false);
      expect(page.puedeProcesarStock).toBe(false);
      expect(notificaciones.show).toHaveBeenCalledWith(
        expect.stringContaining('No se aplicó este cambio'),
        'error',
      );
    },
  );
  it('conserva el resultado persistido si falla la recarga y exige recuperarla para continuar', () => {
    api.actualizarItem.mockReturnValue(of({ ...persistido, cantidad: 7 }));
    api.obtener.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    page.abrirModalEspecialidades(0);

    page.modalItem().cantidad = 7;

    page.agregarItemDesdeModal();

    expect(page.form().items[0].cantidad).toBe(7);
    expect(page.form().items[0].material).toBe('Cemento');
    expect(page.form().items[0].codigoPartida).toBe('01');
    expect(page.detalleAlmacenDesactualizado()).toBe(true);
    expect(page.puedeGestionarItemsAlmacen).toBe(false);

    page.abrirAccion('validar-almacen');

    expect(page.accionModalOpen()).toBe(false);

    detalle.items[0].cantidad = 7;

    api.obtener.mockReturnValue(of(detalle));

    page.recargarItemsAlmacen();

    expect(page.detalleAlmacenDesactualizado()).toBe(false);
    expect(page.puedeGestionarItemsAlmacen).toBe(true);
  });

  it('exige proyecto, fecha e ítems al crear', () => {
    permisos.add('requerimientos.crear');
    page.abrirModalNuevo();
    page.save();

    expect(page.msg()).toContain('proyecto');

    page.form().idProyecto = 6;

    page.save();

    expect(page.msg()).toContain('fecha de entrega');

    page.form().fechaEntrega = '2026-10-20';

    page.save();

    expect(page.msg()).toContain('al menos un ítem');
  });
  it.each([
    ['Registrado', 'requerimientos.enviar', 'puedeEnviar'],
    ['EnviadoAlmacen', 'requerimientos.procesar_stock', 'puedeProcesarStock'],
    ['ValidadoAlmacen', 'requerimientos.aprobar', 'puedeAprobar'],
    ['AprobadoCoordinador', 'requerimientos.enviar_compras', 'puedeEnviarCompras'],
  ] as const)('combina estado %s con el permiso %s', (estado, permiso, propiedad) => {
    permisos.clear();

    page.detalle()!.requerimiento.estado = estado;

    expect(page[propiedad]).toBe(false);

    permisos.add(permiso);

    expect(page[propiedad]).toBe(true);

    page.detalle()!.requerimiento.estado = 'Anulado';

    expect(page[propiedad]).toBe(false);
  });

  it('requiere explicación para observar almacén y rechazar', () => {
    page.abrirAccion('validar-almacen');

    page.accionResultado.set('Observado');

    page.ejecutarAccion();

    expect(api.validarAlmacen).not.toHaveBeenCalled();
    expect(notificaciones.show).toHaveBeenCalledWith(
      expect.stringContaining('explicación'),
      'error',
    );
  });

  it('al cambiar proyecto limpia la imputación y conserva el material y la cantidad', () => {
    page.onProyectoChange();

    expect(page.form().items[0]).toEqual(
      expect.objectContaining({
        idMaterial: 93,
        cantidad: 2.5,
        idPresupuestoDetalle: null,
        codigoPartida: null,
        nombrePartida: null,
      }),
    );
  });
  it('mantiene el guardado del borrador en su endpoint original', () => {
    permisos.add('requerimientos.editar_borrador');

    page.detalle()!.requerimiento.estado = 'Registrado';
    page.detalle()!.puedeEditar = true;

    page.editarDesdeDetalle();
    page.save();

    expect(api.actualizar).toHaveBeenCalledWith(
      45,
      expect.objectContaining({
        items: [
          { idMaterial: 93, cantidad: 2.5, observacion: 'Original', idPresupuestoDetalle: 18 },
        ],
      }),
    );
    expect(api.actualizarItem).not.toHaveBeenCalled();
  });

  it('muestra el material inmutable, la cabecera bloqueada y el último ítem sin opción de quitar', () => {
    page.materiales.set([]);

    page.abrirModalEspecialidades(0);
    fixture.detectChanges();

    const elemento: HTMLElement = fixture.nativeElement;
    const material: HTMLInputElement | null = elemento.querySelector(
      'input[aria-label="Material del ítem"]',
    );

    expect(material?.value).toBe('Cemento');
    expect(material?.readOnly).toBe(true);
    expect(
      elemento.querySelector<HTMLSelectElement>('select option[value="remove"]')?.disabled,
    ).toBe(true);
    expect(elemento.querySelector<HTMLSelectElement>('.requer-form-grid select')?.disabled).toBe(
      true,
    );
  });

  it('conecta la edición de cantidad del formulario con el PATCH individual', async () => {
    page.abrirModalEspecialidades(0);
    fixture.detectChanges();

    const elemento: HTMLElement = fixture.nativeElement;
    const cantidad: HTMLInputElement = elemento.querySelector<HTMLInputElement>('#item-cantidad')!;

    cantidad.value = '4.50';

    cantidad.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    detalle.items[0].cantidad = 4.5;

    elemento.querySelector<HTMLButtonElement>('.item-modal-card .btn-primary')!.click();
    await fixture.whenStable();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, { cantidad: 4.5 });
    expect(page.form().items[0].cantidad).toBe(4.5);
  });

  it.each([
    ['Registrado', 'requerimientos.enviar', 'enviar', 'enviar'],
    ['ValidadoAlmacen', 'requerimientos.aprobar', 'aprobar', 'aprobar'],
    ['ValidadoAlmacen', 'requerimientos.rechazar', 'rechazar', 'rechazar'],
    ['AprobadoCoordinador', 'requerimientos.enviar_compras', 'enviar-compras', 'enviarCompras'],
  ] as const)(
    'ejecuta la transición %s por su operación explícita',
    (estado, permiso, accion, metodo) => {
      page.gestionItemsAlmacen.set(false);
      page.detalle.update((actual) =>
        actual ? { ...actual, requerimiento: { ...actual.requerimiento, estado } } : null,
      );

      permisos.add(permiso);
      page.abrirAccion(accion);

      page.accionObservacion.set('  Explicación  ');

      page.ejecutarAccion();

      expect(flujo[metodo]).toHaveBeenCalledWith(45, { observacion: 'Explicación' });
      expect(page.procesandoAccion()).toBe(false);
      expect(page.accionModalOpen()).toBe(false);
    },
  );

  it('conserva la acción y su observación ante error, bloqueando el doble envío', () => {
    const respuesta = new Subject<RequerimientoActionResponse>();

    page.gestionItemsAlmacen.set(false);
    page.detalle.update((actual) =>
      actual
        ? { ...actual, requerimiento: { ...actual.requerimiento, estado: 'Registrado' } }
        : null,
    );

    permisos.add('requerimientos.enviar');

    flujo.enviar.mockReturnValue(respuesta);

    page.abrirAccion('enviar');

    page.accionObservacion.set('Conservar');

    page.ejecutarAccion();
    page.ejecutarAccion();
    page.cerrarAccion();

    expect(flujo.enviar).toHaveBeenCalledTimes(1);
    expect(page.accionModalOpen()).toBe(true);

    respuesta.error(
      new HttpErrorResponse({ status: 422, error: { message: 'Estado modificado' } }),
    );

    expect(page.procesandoAccion()).toBe(false);
    expect(page.accionObservacion()).toBe('Conservar');
    expect(page.accionModalOpen()).toBe(true);
  });

  it('crea sin campos legacy, mantiene fechas UTC y evita el doble guardado o cierre', () => {
    const respuesta = new Subject<RequerimientoCreadoResponse>();

    flujo.crear.mockReturnValue(respuesta);

    permisos.add('requerimientos.crear');
    page.abrirModalNuevo();

    page.form.update((form) => ({
      ...form,
      fechaRequerimiento: '2026-10-20',
      fechaEntrega: '2026-10-23',
      idProyecto: 6,
      items: structuredClone(detalle.items),
    }));

    page.save();
    page.save();
    page.cerrarFormModal();

    page.reset();

    expect(flujo.crear).toHaveBeenCalledTimes(1);
    expect(flujo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaRequerimiento: '2026-10-20T00:00:00.000Z',
        fechaEntrega: '2026-10-23T00:00:00.000Z',
        items: [
          { idMaterial: 93, cantidad: 2.5, observacion: 'Original', idPresupuestoDetalle: 18 },
        ],
      }),
    );
    expect(flujo.crear.mock.calls[0]).toHaveLength(1);
    expect(page.formModalOpen()).toBe(true);

    respuesta.error(
      new HttpErrorResponse({ status: 422, error: { errors: { items: ['Revisa el detalle'] } } }),
    );

    expect(page.saving()).toBe(false);
    expect(page.form().items).toHaveLength(1);
    expect(page.msg()).toContain('Revisa el detalle');
    expect(page.formModalOpen()).toBe(true);
  });

  it('cancela listados anteriores y actualiza el DOM sin detección manual', async () => {
    const anterior = new Subject<RequerimientoResumen[]>();
    const reciente = new Subject<RequerimientoResumen[]>();

    api.listar.mockReturnValueOnce(anterior).mockReturnValueOnce(reciente);

    page.load();

    page.filtros.update((filtros) => ({ ...filtros, estado: 'Registrado' }));

    page.load();

    expect(anterior.observed).toBe(false);

    reciente.next([{ ...detalle.requerimiento, numeroRequerimiento: 'RQ-RECIENTE' }]);

    reciente.complete();

    anterior.next([{ ...detalle.requerimiento, numeroRequerimiento: 'RQ-VIEJO' }]);

    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('RQ-RECIENTE');
    expect(raiz.textContent).not.toContain('RQ-VIEJO');
    expect(page.cargando()).toBe(false);
  });

  it('muestra fallo del listado y permite recuperarlo sin confundirlo con vacío', async () => {
    api.listar.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

    page.load();

    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('No se pudieron cargar');
    expect(raiz.textContent).not.toContain('No hay requerimientos registrados');

    api.listar.mockReturnValue(of([]));

    page.load();

    await fixture.whenStable();

    expect(raiz.textContent).toContain('No hay requerimientos registrados');
  });

  it('descarta detalles anteriores y cancela las consultas al destruir la vista', () => {
    page.gestionItemsAlmacen.set(false);

    const anterior = new Subject<RequerimientoGetResponse>();
    const reciente = new Subject<RequerimientoGetResponse>();

    api.obtener.mockReturnValueOnce(anterior).mockReturnValueOnce(reciente);

    page.view({ idRequerimiento: 45 });
    page.view({ idRequerimiento: 46 });

    expect(anterior.observed).toBe(false);

    reciente.next({ ...detalle, requerimiento: { ...detalle.requerimiento, idRequerimiento: 46 } });

    expect(page.detalle()?.requerimiento.idRequerimiento).toBe(46);

    const listado = new Subject<RequerimientoResumen[]>();

    api.listar.mockReturnValue(listado);

    page.load();

    fixture.destroy();

    expect(listado.observed).toBe(false);
    expect(reciente.observed).toBe(false);
  });

  it('presenta fechaValidacion del contrato al mostrar el historial autorizado', async () => {
    permisos.add('requerimientos.ver_depuracion_almacen');
    page.cerrarFormModal();

    page.detalle.update((actual) =>
      actual
        ? {
            ...actual,
            validaciones: [
              {
                resultado: 'Conforme',
                usuario: 'Almacén',
                fechaValidacion: '2026-10-20T12:00:00Z',
              },
            ],
          }
        : null,
    );

    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('20/10/2026');
    expect(raiz.textContent).toContain('Almacén');
  });

  it('conserva los catálogos disponibles y permite reintentar el catálogo fallido', async () => {
    const proyectos = vi.spyOn(TestBed.inject(CatalogoProyectos), 'proyectos');

    proyectos.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));

    page.loadCatalogos();

    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;

    expect(raiz.textContent).toContain('No se pudieron cargar los proyectos.');
    expect(page.especialidades()).toHaveLength(1);
    expect(page.materiales()).toHaveLength(2);

    page.loadCatalogos();

    await fixture.whenStable();

    expect(page.errorCatalogos()).toEqual([]);
  });
  it('abrir un requerimiento nuevo cancela el detalle anterior pendiente', () => {
    const pendiente = new Subject<RequerimientoGetResponse>();

    api.obtener.mockReturnValue(pendiente);

    page.view({ idRequerimiento: 46 });
    permisos.add('requerimientos.crear');
    page.abrirModalNuevo();

    expect(pendiente.observed).toBe(false);

    pendiente.next(detalle);

    expect(page.detalleModalOpen()).toBe(false);
    expect(page.formModalOpen()).toBe(true);
    expect(page.form().items).toEqual([]);
  });
  it('sincroniza los controles tipados de proyecto y fecha con el borrador sin Zone.js', async () => {
    vi.spyOn(TestBed.inject(CatalogoProyectos), 'proyectos').mockReturnValue(
      of([{ idProyecto: 6, nombreProyecto: 'Obra', cotizacionGeneral: 0, activo: true }]),
    );

    page.loadCatalogos();

    permisos.add('requerimientos.crear');
    page.abrirModalNuevo();
    await fixture.whenStable();

    const raiz: HTMLElement = fixture.nativeElement;
    const proyecto = raiz.querySelector<HTMLSelectElement>('#formulario-requerimiento-campo-3')!;

    proyecto.value = proyecto.options[1].value;

    proyecto.dispatchEvent(new Event('change'));

    const fecha = raiz.querySelector<HTMLInputElement>('#formulario-requerimiento-campo-4')!;

    fecha.value = '2026-10-23';

    fecha.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(page.form().idProyecto).toBe(6);
    expect(page.form().fechaEntrega).toBe('2026-10-23');
  });
});
