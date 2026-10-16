import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RequerimientosPage } from './requerimientos.page';
import { RequerimientosService } from '../../core/services/requerimientos.service';
import { MaestraService } from '../../core/services/maestra.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  EstadoRequerimiento,
  RequerimientoActionResponse,
  RequerimientoGetResponse,
  RequerimientoItemResponse,
} from '../../models/requerimientos.models';

describe('RequerimientosPage — gestión de ítems en almacén', () => {
  let fixture: ComponentFixture<RequerimientosPage>;
  let page: RequerimientosPage;
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
    listar: vi.fn(() => of([])),
    obtener: vi.fn<() => Observable<RequerimientoGetResponse>>(),
    agregarItem: vi.fn<() => Observable<RequerimientoItemResponse>>(),
    actualizarItem: vi.fn<() => Observable<RequerimientoItemResponse>>(),
    eliminarItem: vi.fn<() => Observable<void>>(),
    validarAlmacen: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    actualizar: vi.fn<() => Observable<RequerimientoActionResponse>>(),
    actualizarCantidadesAlmacen: vi.fn(),
  };
  const notificaciones = { show: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    permisos = new Set(['requerimientos.gestionar_items_almacen', 'requerimientos.procesar_stock']);
    detalle = {
      requerimiento: {
        idRequerimiento: 45,
        numeroRequerimiento: 'RQ-45',
        estado: 'EnviadoAlmacen',
        idProyecto: 6,
        idEspecialidad: 4,
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
      imports: [RequerimientosPage],
      providers: [
        { provide: RequerimientosService, useValue: api },
        {
          provide: AuthService,
          useValue: { hasPermission: (permiso: string) => permisos.has(permiso) },
        },
        { provide: NotificationService, useValue: notificaciones },
        {
          provide: MaestraService,
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
        },
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

    fixture = TestBed.createComponent(RequerimientosPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    page.view({ idRequerimiento: 45 });
    page.editarDesdeDetalle();
  });

  afterEach(() => vi.restoreAllMocks());

  function abrirNuevoItem(): void {
    page.abrirModalEspecialidades();
    page.modalItem.idEspecialidad = 4;
    page.modalItem.idMaterial = 94;
    page.modalItem.cantidad = 3.25;
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
    page.detalle!.requerimiento.estado = estado;
    expect(page.puedeGestionarItemsAlmacen).toBe(false);
    page.abrirModalEspecialidades();
    page.agregarItemDesdeModal();
    page.removeItem(0);
    expect(page.modalEspecialidades).toBe(false);
    expect(api.agregarItem).not.toHaveBeenCalled();
    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(api.eliminarItem).not.toHaveBeenCalled();
  });

  it('exige el permiso nuevo; el permiso anterior no habilita la gestión', () => {
    permisos.clear();
    permisos.add('requerimientos.editar_cantidades_almacen');
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
    expect(page.form.items).toHaveLength(2);
    expect(page.form.items[1].material).toBe('Acero');
    expect(page.detalle?.requerimiento.especialidades).toBe('Estructuras');
    expect(page.modalEspecialidades).toBe(false);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('PATCH envía únicamente la cantidad modificada y usa idRequerimientoDetalle', () => {
    page.abrirModalEspecialidades(0);
    page.modalItem.cantidad = 0.29;
    detalle.items[0].cantidad = 0.29;
    page.agregarItemDesdeModal();

    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, { cantidad: 0.29 });
    expect(page.form.items[0].cantidad).toBe(0.29);
    expect(page.form.items[0].material).toBe('Cemento');
    expect(api.actualizarCantidadesAlmacen).not.toHaveBeenCalled();
    expect(api.actualizar).not.toHaveBeenCalled();
  });

  it('PATCH limpia partida y observación con null y omite cantidad sin cambios', () => {
    page.abrirModalEspecialidades(0);
    page.modalItem.idPresupuestoDetalle = null;
    page.modalItem.observacion = '';
    page.agregarItemDesdeModal();
    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, {
      idPresupuestoDetalle: null,
      observacion: null,
    });
  });

  it('PATCH modifica partida y observación sin incluir cantidad ni material', () => {
    page.abrirModalEspecialidades(0);
    page.modalItem.idPresupuestoDetalle = 29;
    page.modalItem.observacion = 'Nueva observación';
    page.agregarItemDesdeModal();
    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, {
      idPresupuestoDetalle: 29,
      observacion: 'Nueva observación',
    });
  });

  it('PATCH omite los opcionales nulos cuando solo cambia la cantidad', () => {
    page.detalle!.items[0].observacion = null;
    page.detalle!.items[0].idPresupuestoDetalle = null;
    page.editarDesdeDetalle();
    page.abrirModalEspecialidades(0);
    page.modalItem.cantidad = 4;
    page.agregarItemDesdeModal();
    expect(api.actualizarItem).toHaveBeenCalledWith(45, 710, { cantidad: 4 });
  });

  it('no envía PATCH vacío ni confunde los valores opcionales nulos con cambios', () => {
    page.detalle!.items[0].observacion = null;
    page.detalle!.items[0].idPresupuestoDetalle = null;
    page.editarDesdeDetalle();
    page.abrirModalEspecialidades(0);
    page.agregarItemDesdeModal();
    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(page.msg).toBe('No hay cambios para guardar.');
  });

  it.each([null, 0, -1, NaN, Infinity, 1.001, 0.000000001])(
    'rechaza cantidad inválida %s',
    (cantidad) => {
      abrirNuevoItem();
      page.modalItem.cantidad = cantidad;
      page.agregarItemDesdeModal();
      expect(api.agregarItem).not.toHaveBeenCalled();
      expect(page.msg).toContain('dos decimales');
    },
  );

  it('no envía cantidad null en un PATCH', () => {
    page.abrirModalEspecialidades(0);
    page.modalItem.cantidad = null;
    page.agregarItemDesdeModal();
    expect(api.actualizarItem).not.toHaveBeenCalled();
    expect(page.hayCambiosItemAlmacen).toBe(true);
  });

  it('valida observaciones de hasta 250 caracteres', () => {
    abrirNuevoItem();
    page.modalItem.observacion = 'a'.repeat(251);
    page.agregarItemDesdeModal();
    expect(api.agregarItem).not.toHaveBeenCalled();
    page.modalItem.observacion = 'a'.repeat(250);
    page.agregarItemDesdeModal();
    expect(api.agregarItem).toHaveBeenCalled();
  });

  it('impide materiales duplicados', () => {
    abrirNuevoItem();
    page.modalItem.idMaterial = 93;
    page.agregarItemDesdeModal();
    expect(page.msg).toContain('ya existe');
    expect(api.agregarItem).not.toHaveBeenCalled();
  });

  it('exige seleccionar material y revalida el permiso al guardar', () => {
    page.abrirModalEspecialidades();
    page.agregarItemDesdeModal();
    expect(page.msg).toContain('seleccionar un material');
    expect(api.agregarItem).not.toHaveBeenCalled();
    page.modalItem.idMaterial = 94;
    permisos.delete('requerimientos.gestionar_items_almacen');
    page.agregarItemDesdeModal();
    expect(api.agregarItem).not.toHaveBeenCalled();
  });

  it('impide sustituir el material de un ítem existente', () => {
    page.abrirModalEspecialidades(0);
    page.modalItem.idMaterial = 94;
    page.agregarItemDesdeModal();
    expect(page.msg).toContain('no puede modificarse');
    expect(api.actualizarItem).not.toHaveBeenCalled();
  });

  it('confirma la eliminación y nunca elimina el último ítem', () => {
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true);
    page.removeItem(0);
    expect(api.eliminarItem).not.toHaveBeenCalled();
    expect(confirmacion).not.toHaveBeenCalled();

    page.form.items.push({ ...page.form.items[0], idRequerimientoDetalle: 720, idMaterial: 94 });
    confirmacion.mockReturnValueOnce(false);
    page.removeItem(1);
    expect(api.eliminarItem).not.toHaveBeenCalled();
    page.removeItem(1);
    expect(api.eliminarItem).toHaveBeenCalledWith(45, 720);
    expect(page.form.items).toHaveLength(1);
    expect(page.guardandoItem).toBe(false);
  });

  it('recupera los ítems si otro usuario dejó solo el último antes del DELETE', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    page.form.items.push({ ...page.form.items[0], idRequerimientoDetalle: 720, idMaterial: 94 });
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
    expect(page.form.items).toHaveLength(1);
    expect(page.form.items[0].idRequerimientoDetalle).toBe(710);
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
    expect(page.formModalOpen).toBe(true);
    expect(page.accionModalOpen).toBe(false);

    escritura.next({ ...persistido, idRequerimientoDetalle: 720, idMaterial: 94 });
    escritura.complete();
    expect(page.recargandoItems).toBe(true);
    expect(page.form.items[1].material).toBe('Acero');
    page.abrirAccion('validar-almacen');
    expect(page.accionModalOpen).toBe(false);

    lectura.next(detalle);
    lectura.complete();
    expect(page.recargandoItems).toBe(false);
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
    page.modalItem.cantidad = 9;
    page.abrirAccion('validar-almacen');
    expect(page.accionModalOpen).toBe(false);
    page.accionActual = 'validar-almacen';
    page.ejecutarAccion();
    expect(api.validarAlmacen).not.toHaveBeenCalled();
    page.cerrarFormModal();
    expect(page.modalEspecialidades).toBe(true);
    confirmacion.mockReturnValue(true);
    page.cerrarFormModal();
    expect(page.modalEspecialidades).toBe(false);
    expect(page.detalleModalOpen).toBe(true);
    expect(page.detalle?.items[0].cantidad).toBe(2.5);
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
    page.modalItem.cantidad = 6;
    page.agregarItemDesdeModal();
    expect(page.guardandoItem).toBe(false);
    expect(page.detalle?.items[0].cantidad).toBe(2.5);
    expect(page.modalEspecialidades).toBe(true);
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
      page.modalItem.cantidad = 6;
      detalle.requerimiento.estado = 'ValidadoAlmacen';
      detalle.items[0].cantidad = 8;
      page.agregarItemDesdeModal();
      expect(page.form.items[0].cantidad).toBe(8);
      expect(page.modalEspecialidades).toBe(false);
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
    page.modalItem.cantidad = 7;
    page.agregarItemDesdeModal();
    expect(page.form.items[0].cantidad).toBe(7);
    expect(page.form.items[0].material).toBe('Cemento');
    expect(page.form.items[0].codigoPartida).toBe('01');
    expect(page.detalleAlmacenDesactualizado).toBe(true);
    expect(page.puedeGestionarItemsAlmacen).toBe(false);
    page.abrirAccion('validar-almacen');
    expect(page.accionModalOpen).toBe(false);

    detalle.items[0].cantidad = 7;
    api.obtener.mockReturnValue(of(detalle));
    page.recargarItemsAlmacen();
    expect(page.detalleAlmacenDesactualizado).toBe(false);
    expect(page.puedeGestionarItemsAlmacen).toBe(true);
  });

  it('mantiene el guardado del borrador en su endpoint original', () => {
    permisos.add('requerimientos.editar_borrador');
    page.detalle!.requerimiento.estado = 'Registrado';
    page.detalle!.puedeEditar = true;
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
    expect(api.actualizarCantidadesAlmacen).not.toHaveBeenCalled();
  });

  it('muestra el material inmutable, la cabecera bloqueada y el último ítem sin opción de quitar', () => {
    page.materiales = [];
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
    expect(page.form.items[0].cantidad).toBe(4.5);
  });
});
