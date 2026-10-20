import { PartidasRequerimiento } from './partidas-requerimiento';
import { ItemRequerimiento } from './contratos-formulario-requerimiento';
import type { MaterialSeleccionado } from './contratos-formulario-requerimiento';
import {
  imprimirRequerimiento,
  normalizarNombreSolicitante,
} from './impresion-requerimiento/impresion-requerimiento';
import { Especialidad } from '../catalogos/especialidades/contratos-especialidades';
import { CentroCostoResumen, SaldoPartida } from '../app/models/consultas-presupuestarias.models';
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SesionUsuario } from '../core/sesion/sesion-usuario';
import { RequerimientoResumen } from './contratos-requerimientos';
import { Material } from '../catalogos/materiales/contratos-materiales';
import { ReferenciasRequerimiento } from './referencias-requerimiento/referencias-requerimiento';
import { ConsultaRequerimientos } from './consulta-requerimientos/consulta-requerimientos';
import { BorradorRequerimiento } from './borrador-requerimiento/borrador-requerimiento';
import { EdicionItemRequerimiento } from './edicion-item-requerimiento/edicion-item-requerimiento';
import { ItemsAlmacenRequerimiento } from './items-almacen-requerimiento/items-almacen-requerimiento';
import { FlujoRequerimiento } from './flujo-requerimiento/flujo-requerimiento';
import { AccionFlujo } from './flujo-requerimiento/flujo-requerimiento';

@Injectable()
export class EstadoRequerimientos {
  private readonly referencias = inject(ReferenciasRequerimiento);
  private readonly consultas = inject(ConsultaRequerimientos);
  private readonly borrador = inject(BorradorRequerimiento);
  private readonly editor = inject(EdicionItemRequerimiento);
  private readonly almacen = inject(ItemsAlmacenRequerimiento);
  private readonly flujo = inject(FlujoRequerimiento);
  readonly presupuesto = inject(PartidasRequerimiento);
  readonly auth = inject(SesionUsuario);
  private readonly destroyRef = inject(DestroyRef);

  readonly centrosCosto = this.presupuesto.centros;
  readonly partidasPresupuesto = this.presupuesto.partidas;
  readonly cargandoPartidas = this.presupuesto.cargando;
  readonly partidasCatalogo = this.presupuesto.catalogo;
  readonly errorPartidas = this.presupuesto.error;

  readonly formModalOpen = signal(false);
  readonly detalleModalOpen = signal(false);

  readonly normalizarNombreSolicitante = normalizarNombreSolicitante;

  readonly rows = this.consultas.rows;
  readonly filtros = this.consultas.filtros;
  readonly detalle = this.consultas.detalle;
  readonly cargando = this.consultas.cargando;
  readonly errorListado = this.consultas.errorListado;
  readonly cargandoDetalle = this.consultas.cargandoDetalle;

  readonly especialidades = this.referencias.especialidades;
  readonly proyectos = this.referencias.proyectos;
  readonly materiales = this.referencias.materiales;
  readonly unidadesMedida = this.referencias.unidadesMedida;
  readonly cargandoCatalogos = this.referencias.cargandoCatalogos;
  readonly errorCatalogos = this.referencias.errorCatalogos;

  readonly form = this.borrador.form;
  readonly editando = this.borrador.editando;
  readonly gestionItemsAlmacen = this.borrador.gestionItemsAlmacen;
  readonly requerimientoEditandoId = this.borrador.requerimientoEditandoId;
  readonly saving = this.borrador.saving;
  readonly msg = this.borrador.msg;
  readonly especialidadesSeleccionadas = this.borrador.especialidadesSeleccionadas;

  readonly modalEspecialidades = this.editor.modalEspecialidades;
  readonly modalItem = this.editor.modalItem;
  readonly editingItemIndex = this.editor.editingItemIndex;
  readonly avisoPartidaMaterial = this.editor.avisoPartidaMaterial;
  readonly materialFormOpen = this.editor.materialFormOpen;
  readonly savingMaterial = this.editor.savingMaterial;

  readonly guardandoItem = this.almacen.guardandoItem;
  readonly recargandoItems = this.almacen.recargandoItems;
  readonly detalleAlmacenDesactualizado = this.almacen.detalleAlmacenDesactualizado;

  readonly accionModalOpen = this.flujo.accionModalOpen;
  readonly accionActual = this.flujo.accionActual;
  readonly accionObservacion = this.flujo.accionObservacion;
  readonly accionResultado = this.flujo.accionResultado;
  readonly procesandoAccion = this.flujo.procesandoAccion;

  constructor() {
    this.consultas.listadoRecibido.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.editando() && !this.form().items.length && !this.form().idProyecto)
        this.borrador.setFormDefaults(true);
    });

    this.consultas.detalleRecibido
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((detalle) => {
        this.detalleAlmacenDesactualizado.set(false);
        this.detalleModalOpen.set(!!detalle);

        if (detalle) this.formModalOpen.set(false);
      });

    this.borrador.guardado
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ id, editando }) => {
        this.reset();

        this.formModalOpen.set(false);

        this.load();

        if (editando && id) this.view({ idRequerimiento: id });
      });

    this.flujo.completada.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((id) => {
      this.load();

      this.view({ idRequerimiento: id });
    });
  }

  get materialesFiltradosModal(): Material[] {
    return this.editor.materialesFiltradosModal;
  }

  get centroCostoDelProyecto(): CentroCostoResumen | null {
    return this.editor.centroCostoDelProyecto;
  }

  get proyectoSinCentroCosto(): boolean {
    return this.editor.proyectoSinCentroCosto;
  }

  get partidaSeleccionadaModal(): SaldoPartida | null {
    return this.editor.partidaSeleccionadaModal;
  }

  get hayCambiosItemAlmacen(): boolean {
    return this.editor.hayCambiosItemAlmacen;
  }

  get operacionItemPendiente(): boolean {
    return this.almacen.operacionItemPendiente;
  }

  get puedeGestionarItemsAlmacen(): boolean {
    return this.almacen.puedeGestionarItemsAlmacen;
  }

  get puedeCrear(): boolean {
    return this.flujo.puedeCrear;
  }

  get puedeEnviar(): boolean {
    return this.flujo.puedeEnviar;
  }

  get puedeProcesarStock(): boolean {
    return this.flujo.puedeProcesarStock;
  }

  get puedeAprobar(): boolean {
    return this.flujo.puedeAprobar;
  }

  get puedeRechazar(): boolean {
    return this.flujo.puedeRechazar;
  }

  get puedeEnviarCompras(): boolean {
    return this.flujo.puedeEnviarCompras;
  }

  get tieneAccionesFlujo(): boolean {
    return this.flujo.tieneAccionesFlujo;
  }

  get accionTitulo(): string {
    return this.flujo.accionTitulo;
  }

  get puedeEditarDetalle(): boolean {
    return (
      (!!this.detalle()?.puedeEditar &&
        this.detalle()?.requerimiento.estado === 'Registrado' &&
        this.auth.hasPermission('requerimientos.editar_borrador')) ||
      this.puedeGestionarItemsAlmacen
    );
  }

  abrirModalNuevo(): void {
    if (
      !this.puedeCrear ||
      this.saving() ||
      this.operacionItemPendiente ||
      this.procesandoAccion() ||
      this.savingMaterial()
    )
      return;

    this.reset();

    this.formModalOpen.set(true);
    this.detalleModalOpen.set(false);
  }

  cerrarFormModal(): void {
    if (this.operacionItemPendiente || this.saving() || this.savingMaterial()) return;

    if (this.modalEspecialidades() && !this.cerrarModalEspecialidades()) return;

    this.formModalOpen.set(false);

    if (this.gestionItemsAlmacen()) this.detalleModalOpen.set(true);
  }

  cerrarDetalleModal(): void {
    this.consultas.consultar(null);

    this.detalleModalOpen.set(false);
  }

  onAccionListado(event: Event, row: Pick<RequerimientoResumen, 'idRequerimiento'>): void {
    const value = (event.target as HTMLSelectElement).value;

    (event.target as HTMLSelectElement).value = '';

    if (value === 'ver') this.view(row);
  }

  onAccionItem(event: Event, index: number): void {
    const value = (event.target as HTMLSelectElement).value;

    (event.target as HTMLSelectElement).value = '';

    if (value === 'edit') this.abrirModalEspecialidades(index);

    if (value === 'remove') this.removeItem(index);
  }

  view(row: Pick<RequerimientoResumen, 'idRequerimiento'>): void {
    if (this.operacionItemPendiente || this.saving() || this.procesandoAccion()) return;

    this.consultas.consultar(row.idRequerimiento);
  }

  descargarPdfRequerimiento(): void {
    const detalle = this.detalle();

    if (detalle) imprimirRequerimiento(detalle);
  }

  iniciar(): void {
    this.borrador.setFormDefaults(true);

    this.load();

    this.loadCatalogos();

    this.presupuesto.iniciar();
  }

  load(): void {
    this.consultas.load();
  }

  loadCatalogos(): void {
    this.referencias.loadCatalogos();
  }

  onProyectoChange(): void {
    this.editor.onProyectoChange();
  }

  cargarPartidasPresupuesto(): void {
    this.editor.cargarPartidasPresupuesto();
  }

  onModalMaterialChange(): void {
    this.editor.onModalMaterialChange();
  }

  onModalEspecialidadChange(): void {
    this.editor.onModalEspecialidadChange();
  }

  abrirModalEspecialidades(index?: number): void {
    if (this.saving() || this.savingMaterial()) return;

    if (
      this.gestionItemsAlmacen() &&
      (!this.puedeGestionarItemsAlmacen || this.operacionItemPendiente || this.procesandoAccion())
    )
      return;

    this.editor.abrirModalEspecialidades(index);
  }

  cerrarModalEspecialidades(descartar = false): boolean {
    if (this.guardandoItem() || this.savingMaterial()) return false;

    return this.editor.cerrarModalEspecialidades(descartar);
  }

  abrirFormNuevoMaterial(): void {
    this.editor.abrirFormNuevoMaterial();
  }

  cerrarFormNuevoMaterial(): void {
    this.editor.cerrarFormNuevoMaterial();
  }

  seleccionarMaterialCreado(evento: MaterialSeleccionado): void {
    this.editor.seleccionarMaterialCreado(evento);
  }

  agregarItemDesdeModal(): void {
    if (this.gestionItemsAlmacen()) this.almacen.guardarItemAlmacen(this.procesandoAccion());
    else this.editor.agregarItemDesdeModal();
  }

  removeItem(index: number): void {
    if (this.saving()) return;

    if (this.gestionItemsAlmacen())
      this.almacen.eliminarItemAlmacen(this.form().items[index], this.procesandoAccion());
    else this.editor.removeItem(index);
  }

  recargarItemsAlmacen(): void {
    this.almacen.recargarItemsAlmacen();
  }

  editarDesdeDetalle(): void {
    const detalle = this.detalle();

    if (!detalle?.requerimiento.idRequerimiento || this.operacionItemPendiente) return;

    if (!this.puedeEditarDetalle) {
      this.msg.set('Este requerimiento ya no puede modificarse.');
      return;
    }

    this.borrador.preparar(detalle);

    this.cargarPartidasPresupuesto();

    this.formModalOpen.set(true);
    this.detalleModalOpen.set(false);
  }

  abrirAccion(accion: AccionFlujo): void {
    this.flujo.abrirAccion(accion);
  }

  cerrarAccion(): void {
    this.flujo.cerrarAccion();
  }

  ejecutarAccion(): void {
    this.flujo.ejecutarAccion();
  }

  save(): void {
    if (this.gestionItemsAlmacen()) {
      this.cerrarFormModal();
      return;
    }

    this.borrador.guardar();
  }

  reset(): void {
    if (this.operacionItemPendiente || this.saving() || this.savingMaterial()) return;

    this.consultas.consultar(null);

    this.presupuesto.cargar(null);

    this.editor.reiniciar();
    this.borrador.reiniciar();
  }

  partidaPorDetalle(idPresupuestoDetalle: number | null | undefined): SaldoPartida | null {
    return this.editor.partidaPorDetalle(idPresupuestoDetalle);
  }

  etiquetaPartida(item: ItemRequerimiento): string {
    return this.editor.etiquetaPartida(item);
  }

  getIdEspecialidad(value: Material | Especialidad | undefined): number | null {
    return this.editor.getIdEspecialidad(value);
  }

  getNombreEspecialidad(value: Material | Especialidad | undefined): string {
    return this.editor.getNombreEspecialidad(value);
  }

  getIdMaterial(value: Material | undefined): number | null {
    return this.editor.getIdMaterial(value);
  }

  getDescripcionMaterial(value: Material | undefined): string {
    return this.editor.getDescripcionMaterial(value);
  }

  getUnidadMaterial(value: Material | undefined): string {
    return this.editor.getUnidadMaterial(value);
  }
}
