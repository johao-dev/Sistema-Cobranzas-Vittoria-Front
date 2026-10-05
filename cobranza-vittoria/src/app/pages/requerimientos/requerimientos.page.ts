import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { RequerimientosService } from '../../core/services/requerimientos.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { extraerMensajeError } from '../../core/utils/api-error.util';
import {
  RequerimientoFilters,
  RequerimientoCantidadAlmacenRequest,
  RequerimientoGetResponse,
  RequerimientoRequest,
  RequerimientoResumen,
  ResultadoValidacionAlmacen
} from '../../models/requerimientos.models';
import { Observable } from 'rxjs';

type AccionFlujo = 'enviar' | 'validar-almacen' | 'aprobar' | 'rechazar' | 'enviar-compras';

@Component({
  standalone: true,
  selector: 'app-requerimientos-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './requerimientos.page.html',
  styleUrls: ['./requerimientos.page.css']
})
export class RequerimientosPage implements OnInit {
  rows: RequerimientoResumen[] = [];
  especialidades: any[] = [];
  proyectos: any[] = [];
  materiales: any[] = [];
  unidadesMedida: any[] = [];
  /** Centros de costo activos, para resolver el que corresponde al proyecto del RQ. */
  centrosCosto: any[] = [];
  /** Filas de vw_Saldo de la versión aprobada: partida, saldo disponible y moneda. */
  partidasPresupuesto: any[] = [];
  cargandoPartidas = false;
  /** Partidas hoja activas del catálogo, para la partida por defecto de un material nuevo. */
  partidasCatalogo: any[] = [];
  /** Aviso cuando la partida del material no pudo asignarse sola. */
  avisoPartidaMaterial = '';
  /**
   * Detalle que el sistema asignó solo por el material. Si al cambiar de material
   * la partida sigue siendo esa, se reemplaza; si el residente la cambió a mano, se respeta.
   */
  private partidaAutoAsignada: number | null = null;
  detalle: RequerimientoGetResponse | null = null;
  formModalOpen = false;
  detalleModalOpen = false;

  filtros: RequerimientoFilters = {
    estado: '',
    idEspecialidad: null,
    idProyecto: null
  };

  editando = false;
  edicionSoloCantidadesAlmacen = false;
  puedeEditarDetalle = false;
  requerimientoEditandoId: number | null = null;

  accionModalOpen = false;
  accionActual: AccionFlujo | null = null;
  accionObservacion = '';
  accionResultado: ResultadoValidacionAlmacen = 'Conforme';
  procesandoAccion = false;

  modalEspecialidades = false;
  materialFormOpen = false;
  savingMaterial = false;
  msgMaterial = '';
  editingItemIndex: number | null = null;
  modalItem = {
    idEspecialidad: null as number | null,
    idMaterial: null as number | null,
    idPresupuestoDetalle: null as number | null,
    cantidad: 1,
    observacion: ''
  };

  nuevoMaterial = {
    idEspecialidad: null as number | null,
    codigo: '',
    codigoProveedor: '',
    descripcion: '',
    unidadMedida: '',
    stockMinimo: 0,
    activo: true,
    idCatalogoPartida: null as number | null
  };

  form: any = {
    numeroRequerimiento: '',
    fechaRequerimiento: '',
    idProyecto: null,
    descripcion: '',
    fechaEntrega: '',
    observacion: '',
    items: []
  };

  msg = '';
  saving = false;

  get especialidadesSeleccionadas(): string[] {
    const values = (this.form.items || [])
      .map((x: any) => (x.especialidad || '').trim())
      .filter((x: string) => !!x);
    return Array.from(new Set(values));
  }

  get materialesFiltradosModal(): any[] {
    if (!this.modalItem.idEspecialidad) return [];
    return (this.materiales || []).filter((m: any) => Number(this.getIdEspecialidad(m)) === Number(this.modalItem.idEspecialidad));
  }

  constructor(
    private requerimientos: RequerimientosService,
    private maestra: MaestraService,
    private controlPresupuestario: ControlPresupuestarioService,
    public readonly auth: AuthService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  // Los botones requieren simultáneamente el claim y el estado indicado por el contrato.
  get puedeCrear(): boolean {
    return this.auth.hasPermission('requerimientos.crear');
  }

  get puedeEnviar(): boolean {
    return this.estadoDetalle === 'Registrado' && this.auth.hasPermission('requerimientos.enviar');
  }

  get puedeProcesarStock(): boolean {
    return this.estadoDetalle === 'EnviadoAlmacen' && this.auth.hasPermission('requerimientos.procesar_stock');
  }

  get puedeEditarCantidadesAlmacen(): boolean {
    return this.estadoDetalle === 'EnviadoAlmacen'
      && this.auth.hasPermission('requerimientos.editar_cantidades_almacen');
  }

  get puedeAprobar(): boolean {
    return this.estadoDetalle === 'ValidadoAlmacen' && this.auth.hasPermission('requerimientos.aprobar');
  }

  get puedeRechazar(): boolean {
    return ['ValidadoAlmacen', 'AprobadoCoordinador'].includes(this.estadoDetalle)
      && this.auth.hasPermission('requerimientos.rechazar');
  }

  get puedeEnviarCompras(): boolean {
    return this.estadoDetalle === 'AprobadoCoordinador'
      && this.auth.hasPermission('requerimientos.enviar_compras');
  }

  get tieneAccionesFlujo(): boolean {
    return this.puedeEnviar || this.puedeProcesarStock || this.puedeAprobar
      || this.puedeRechazar || this.puedeEnviarCompras;
  }

  get accionTitulo(): string {
    const titulos: Record<AccionFlujo, string> = {
      enviar: 'Enviar a almacén',
      'validar-almacen': 'Procesar stock',
      aprobar: 'Aprobar requerimiento',
      rechazar: 'Rechazar requerimiento',
      'enviar-compras': 'Enviar a compras'
    };
    return this.accionActual ? titulos[this.accionActual] : 'Acción';
  }

  private get estadoDetalle(): string {
    return this.detalle?.requerimiento?.estado ?? '';
  }

  abrirModalNuevo(): void {
    if (!this.puedeCrear) return;
    this.reset();
    this.formModalOpen = true;
    this.detalleModalOpen = false;
    this.cdr.detectChanges();
  }

  cerrarFormModal(): void {
    this.formModalOpen = false;
    this.cdr.detectChanges();
  }

  cerrarDetalleModal(): void {
    this.detalleModalOpen = false;
    this.cdr.detectChanges();
  }

  onAccionListado(event: Event, row: any): void {
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

  ngOnInit(): void {
    this.setFormDefaults(true);
    this.load();
    this.loadCatalogos();
    this.cargarPartidasCatalogo();
  }

  /** Sin permiso sobre Control Presupuestario el material nuevo se crea sin partida, como antes. */
  private cargarPartidasCatalogo(): void {
    this.controlPresupuestario.partidas({ activo: true, esHoja: true }).subscribe({
      next: (x: any) => {
        this.partidasCatalogo = x ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.partidasCatalogo = [];
      }
    });
  }

  /**
   * Al elegir un material, su partida por defecto se busca en la versión aprobada
   * del presupuesto del proyecto y se asigna sola. El residente puede cambiarla.
   */
  onModalMaterialChange(): void {
    this.avisoPartidaMaterial = '';
    if (this.partidaAutoAsignada !== null && this.modalItem.idPresupuestoDetalle === this.partidaAutoAsignada) {
      this.modalItem.idPresupuestoDetalle = null;
    }
    this.partidaAutoAsignada = null;
    const material = (this.materiales || [])
      .find((m: any) => Number(this.getIdMaterial(m)) === Number(this.modalItem.idMaterial));
    if (!material) return;
    this.aplicarPartidaDelMaterial(material);
  }

  private aplicarPartidaDelMaterial(material: any): void {
    const idPartida = Number(material?.idCatalogoPartida ?? material?.IdCatalogoPartida ?? 0);
    if (!idPartida) {
      this.avisoPartidaMaterial = 'Este material no tiene partida por defecto: elígela manualmente.';
      return;
    }
    const etiqueta = material?.codigoPartida
      ? `${material.codigoPartida} — ${material.nombrePartida ?? ''}`.trim()
      : 'del material';
    if (!this.form?.idProyecto) {
      this.avisoPartidaMaterial = `Selecciona el proyecto para asignar la partida ${etiqueta}.`;
      return;
    }
    const coincidencias = (this.partidasPresupuesto || [])
      .filter((p: any) => Number(p.idCatalogoPartida) === idPartida);
    if (coincidencias.length === 1) {
      this.modalItem.idPresupuestoDetalle = coincidencias[0].idPresupuestoDetalle;
      this.partidaAutoAsignada = coincidencias[0].idPresupuestoDetalle;
    } else if (coincidencias.length > 1) {
      this.avisoPartidaMaterial =
        `La partida ${etiqueta} está en más de un presupuesto aprobado del proyecto: elige cuál.`;
    } else {
      this.avisoPartidaMaterial =
        `La partida ${etiqueta} no está en el presupuesto aprobado del proyecto: elige otra partida.`;
    }
  }

  load(): void {
    this.requerimientos.listar(this.filtros).subscribe({
      next: (x) => {
        this.rows = x ?? [];
        if (!this.editando && !this.form.items.length && !this.form.idProyecto) {
          this.setFormDefaults(true);
        }
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.rows = [];
        if (!this.editando && !this.form.items.length && !this.form.idProyecto) {
          this.setFormDefaults(true);
        }
        this.notifyService.show(extraerMensajeError(error, 'No se pudieron cargar los requerimientos.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  loadCatalogos(): void {
    this.maestra.especialidades(true).subscribe({ next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); }, error: () => { this.especialidades = []; this.cdr.detectChanges(); } });
    this.maestra.proyectos(true).subscribe({ next: (x: any) => { this.proyectos = x ?? []; this.cdr.detectChanges(); }, error: () => { this.proyectos = []; this.cdr.detectChanges(); } });
    this.maestra.materiales(true).subscribe({ next: (x: any) => { this.materiales = x ?? []; this.cdr.detectChanges(); }, error: () => { this.materiales = []; this.cdr.detectChanges(); } });
    this.maestra.unidadesMedida(true).subscribe({ next: (x: any) => { this.unidadesMedida = x ?? []; this.cdr.detectChanges(); }, error: () => { this.unidadesMedida = []; this.cdr.detectChanges(); } });
    this.controlPresupuestario.centrosCosto(true, null, null).subscribe({
      next: (x: any) => { this.centrosCosto = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.centrosCosto = []; this.cdr.detectChanges(); }
    });
  }

  /**
   * El presupuesto se alcanza por proyecto: Proyecto -> CentroCosto (1:1) ->
   * presupuesto -> versión aprobada -> partidas con saldo. Si el proyecto no
   * tiene centro de costo, el RQ se sigue registrando sin imputación.
   */
  get centroCostoDelProyecto(): any | null {
    const idProyecto = this.form?.idProyecto;
    if (!idProyecto) return null;
    return (this.centrosCosto || []).find((c: any) => Number(c.idProyecto) === Number(idProyecto)) ?? null;
  }

  get proyectoSinCentroCosto(): boolean {
    return !!this.form?.idProyecto && !this.centroCostoDelProyecto;
  }

  onProyectoChange(): void {
    // Las partidas dependen del proyecto: al cambiarlo, la imputación anterior deja de ser válida.
    (this.form.items || []).forEach((item: any) => {
      item.idPresupuestoDetalle = null;
      item.codigoPartida = null;
      item.nombrePartida = null;
    });
    this.cargarPartidasPresupuesto();
  }

  cargarPartidasPresupuesto(): void {
    const centro = this.centroCostoDelProyecto;
    if (!centro) {
      this.partidasPresupuesto = [];
      this.cdr.detectChanges();
      return;
    }

    this.cargandoPartidas = true;
    this.controlPresupuestario.saldos({
      idCentroCosto: centro.idCentroCosto,
      estadoPresupuesto: 'APROBADO'
    }).subscribe({
      next: (x: any) => {
        this.partidasPresupuesto = x ?? [];
        this.cargandoPartidas = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.partidasPresupuesto = [];
        this.cargandoPartidas = false;
        this.cdr.detectChanges();
      }
    });
  }

  partidaPorDetalle(idPresupuestoDetalle: any): any | null {
    if (idPresupuestoDetalle === null || idPresupuestoDetalle === undefined) return null;
    return (this.partidasPresupuesto || [])
      .find((p: any) => Number(p.idPresupuestoDetalle) === Number(idPresupuestoDetalle)) ?? null;
  }

  /** Etiqueta de la partida imputada a una línea, para tabla y detalle. */
  etiquetaPartida(item: any): string {
    if (!item?.idPresupuestoDetalle) return 'Sin imputar';
    if (item.codigoPartida) return `${item.codigoPartida} — ${item.nombrePartida ?? ''}`.trim();
    const partida = this.partidaPorDetalle(item.idPresupuestoDetalle);
    return partida ? `${partida.codigoPartida} — ${partida.partida}` : 'Partida no disponible';
  }

  get partidaSeleccionadaModal(): any | null {
    return this.partidaPorDetalle(this.modalItem.idPresupuestoDetalle);
  }

  abrirModalEspecialidades(index?: number): void {
    this.msg = '';
    this.avisoPartidaMaterial = '';
    this.partidaAutoAsignada = null;
    this.modalEspecialidades = true;

    if (index !== undefined && index !== null && index >= 0) {
      const item = this.form.items[index];
      this.editingItemIndex = index;
      this.modalItem = {
        idEspecialidad: item?.idEspecialidad ?? null,
        idMaterial: item?.idMaterial ?? null,
        idPresupuestoDetalle: item?.idPresupuestoDetalle ?? null,
        cantidad: Number(item?.cantidad ?? 1),
        observacion: item?.observacion ?? ''
      };
      return;
    }

    this.editingItemIndex = null;
    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: ''
    };
  }

  cerrarModalEspecialidades(): void {
    this.avisoPartidaMaterial = '';
    this.partidaAutoAsignada = null;
    this.modalEspecialidades = false;
    this.materialFormOpen = false;
    this.msgMaterial = '';
    this.editingItemIndex = null;
    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: ''
    };
  }

  onModalEspecialidadChange(): void {
    this.modalItem.idMaterial = null;
    this.avisoPartidaMaterial = '';
    if (this.partidaAutoAsignada !== null && this.modalItem.idPresupuestoDetalle === this.partidaAutoAsignada) {
      this.modalItem.idPresupuestoDetalle = null;
    }
    this.partidaAutoAsignada = null;
    if (this.materialFormOpen) {
      this.nuevoMaterial.idEspecialidad = this.modalItem.idEspecialidad;
    }
  }

  abrirFormNuevoMaterial(): void {
    this.msg = '';
    this.msgMaterial = '';
    this.materialFormOpen = true;
    this.nuevoMaterial = {
      idEspecialidad: this.modalItem.idEspecialidad,
      codigo: '',
      codigoProveedor: '',
      descripcion: '',
      unidadMedida: '',
      stockMinimo: 0,
      activo: true,
      // Propone la partida que el ítem ya tiene elegida, si la hay.
      idCatalogoPartida: this.partidaSeleccionadaModal?.idCatalogoPartida ?? null
    };
  }

  cerrarFormNuevoMaterial(): void {
    this.materialFormOpen = false;
    this.msgMaterial = '';
  }

  guardarMaterialDesdeItem(): void {
    this.msgMaterial = '';

    const payload = {
      idMaterial: null,
      idEspecialidad: this.nuevoMaterial.idEspecialidad != null ? Number(this.nuevoMaterial.idEspecialidad) : 0,
      codigo: '',
      codigoProveedor: (this.nuevoMaterial.codigoProveedor ?? '').toString().trim(),
      descripcion: (this.nuevoMaterial.descripcion ?? '').toString().trim(),
      unidadMedida: (this.nuevoMaterial.unidadMedida ?? '').toString().trim(),
      stockMinimo: Number(this.nuevoMaterial.stockMinimo ?? 0) || 0,
      activo: true,
      idCatalogoPartida: this.nuevoMaterial.idCatalogoPartida ?? null
    };

    if (!payload.idEspecialidad || payload.idEspecialidad <= 0) {
      this.msgMaterial = 'Debes seleccionar una especialidad.';
      return;
    }


    if (!payload.descripcion) {
      this.msgMaterial = 'Debes ingresar el material.';
      return;
    }

    if (!payload.unidadMedida) {
      this.msgMaterial = 'Debes seleccionar la unidad de medida.';
      return;
    }

    this.savingMaterial = true;

    this.maestra.guardarMaterial(payload).subscribe({
      next: (resp: any) => {
        this.savingMaterial = false;
        this.msgMaterial = 'Material agregado correctamente.';
        this.notifyService.show(this.msgMaterial, 'success');

        this.maestra.materiales(true).subscribe({
          next: (materiales: any) => {
            this.materiales = materiales ?? [];
            const nuevoId = Number(resp?.idMaterial ?? resp?.IdMaterial ?? 0);
            const materialCreado = this.materiales.find((m: any) =>
              (nuevoId && Number(this.getIdMaterial(m)) === nuevoId) ||
              (Number(this.getIdEspecialidad(m)) === payload.idEspecialidad &&
                this.getDescripcionMaterial(m).toUpperCase() === payload.descripcion.toUpperCase())
            );

            this.modalItem.idEspecialidad = payload.idEspecialidad;
            if (materialCreado) {
              this.modalItem.idMaterial = this.getIdMaterial(materialCreado);
              this.onModalMaterialChange();
            }

            this.cerrarFormNuevoMaterial();
            this.cdr.detectChanges();
          },
          error: () => {
            this.cerrarFormNuevoMaterial();
            this.cdr.detectChanges();
          }
        });
      },
      error: (e: any) => {
        this.savingMaterial = false;
        const apiErrors = e?.error?.errors;
        if (apiErrors) {
          this.msgMaterial = Object.values(apiErrors).flat().join(' ') || 'No se pudo agregar el material.';
        } else {
          this.msgMaterial = e?.error?.message || 'No se pudo agregar el material.';
        }
        this.notifyService.show(this.msgMaterial, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  agregarItemDesdeModal(): void {
    this.msg = '';

    if (!this.modalItem.idEspecialidad) {
      this.msg = 'Debes seleccionar una especialidad.';
      return;
    }

    if (!this.modalItem.idMaterial) {
      this.msg = 'Debes seleccionar un material.';
      return;
    }

    if (!this.modalItem.cantidad || Number(this.modalItem.cantidad) <= 0) {
      this.msg = 'La cantidad debe ser mayor a 0.';
      return;
    }

    const material = this.materiales.find((m: any) => Number(this.getIdMaterial(m)) === Number(this.modalItem.idMaterial));
    const especialidad = this.especialidades.find((e: any) => Number(this.getIdEspecialidad(e)) === Number(this.modalItem.idEspecialidad));

    const nuevoItem = {
      idMaterial: Number(this.modalItem.idMaterial),
      idEspecialidad: Number(this.modalItem.idEspecialidad),
      especialidad: this.getNombreEspecialidad(material) || this.getNombreEspecialidad(especialidad) || '',
      material: this.getDescripcionMaterial(material),
      unidadMedida: this.getUnidadMaterial(material),
      cantidad: Number(this.modalItem.cantidad),
      observacion: this.modalItem.observacion ?? '',
      idPresupuestoDetalle: this.modalItem.idPresupuestoDetalle ?? null,
      codigoPartida: this.partidaSeleccionadaModal?.codigoPartida ?? null,
      nombrePartida: this.partidaSeleccionadaModal?.partida ?? null
    };

    if (this.editingItemIndex !== null && this.editingItemIndex >= 0) {
      this.form.items[this.editingItemIndex] = nuevoItem;
      this.msg = 'Ítem actualizado correctamente.';
    } else {
      this.form.items.push(nuevoItem);
      this.msg = 'Ítem agregado correctamente.';
    }

    this.cerrarModalEspecialidades();
  }

  removeItem(index: number): void {
    this.form.items.splice(index, 1);
  }

  view(row: any): void {
    this.requerimientos.obtener(row.idRequerimiento).subscribe({
      next: (x) => {
        this.detalle = x;
        this.puedeEditarDetalle = (!!x?.puedeEditar
          && x.requerimiento.estado === 'Registrado'
          && this.auth.hasPermission('requerimientos.editar_borrador'))
          || this.puedeEditarCantidadesAlmacen;
        this.detalleModalOpen = true;
        this.formModalOpen = false;
        this.cdr.detectChanges();
      },
      error: (error: unknown) => {
        this.detalle = null;
        this.puedeEditarDetalle = false;
        this.notifyService.show(extraerMensajeError(error, 'No se pudo cargar el detalle.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  editarDesdeDetalle(): void {
    if (!this.detalle?.requerimiento?.idRequerimiento) return;
    if (!this.puedeEditarDetalle) {
      this.msg = 'Este requerimiento ya no puede modificarse.';
      return;
    }

    const req = this.detalle.requerimiento;
    const items = this.detalle.items || [];

    this.editando = true;
    this.edicionSoloCantidadesAlmacen = req.estado === 'EnviadoAlmacen';
    this.requerimientoEditandoId = req.idRequerimiento;

    this.form = {
      numeroRequerimiento: req.numeroRequerimiento ?? '',
      fechaRequerimiento: this.toDateInput(req.fechaRequerimiento),
      idProyecto: req.idProyecto ?? null,
      descripcion: req.descripcion ?? '',
      fechaEntrega: this.toDateInput(req.fechaEntrega),
      observacion: req.observacion ?? '',
      items: items.map((x: any) => ({
        idRequerimientoDetalle: x.idRequerimientoDetalle,
        idMaterial: x.idMaterial,
        idEspecialidad: x.idEspecialidad ?? null,
        especialidad: x.especialidad ?? '',
        material: x.material,
        unidadMedida: x.unidadMedida ?? x.unidad ?? '-',
        cantidad: Number(x.cantidad),
        observacion: x.observacion ?? '',
        idPresupuestoDetalle: x.idPresupuestoDetalle ?? null,
        codigoPartida: x.codigoPartida ?? null,
        nombrePartida: x.nombrePartida ?? null
      }))
    };

    this.cargarPartidasPresupuesto();
    this.msg = 'Editando requerimiento.';
    this.formModalOpen = true;
    this.detalleModalOpen = false;
    this.cdr.detectChanges();
  }
  private normalizarTexto(value: any): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  normalizarNombreSolicitante(value: any): string {
    const normalized = this.normalizarTexto(value);
    if (!normalized) return '-';
    if (normalized.includes('administrador')) return 'Administrador';
    if (normalized.includes('contable')) return 'Contable';
    if (normalized.includes('ingeniero')) return 'Ingeniero';
    if (normalized.includes('jefe') && normalized.includes('almacen')) return 'Jefe de Almacen';
    return String(value ?? '').replace(/\s+/g, ' ').trim() || '-';
  }

  descargarPdfRequerimiento(): void {
    if (!this.detalle?.requerimiento) return;

    const req = this.detalle.requerimiento;
    const items = this.detalle.items || [];
    const rows = items.map((x: any) => `
      <tr>
        <td>${this.escapeHtml(x.especialidad || '-')}</td>
        <td>${this.escapeHtml(x.material || '-')}</td>
        <td>${this.escapeHtml(x.unidadMedida || x.unidad || '-')}</td>
        <td style="text-align:right;">${Number(x.cantidad || 0).toLocaleString('es-PE')}</td>
        <td>${this.escapeHtml(x.observacion || '-')}</td>
      </tr>
    `).join('');

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
      <head>
        <title>Requerimiento ${this.escapeHtml(req.numeroRequerimiento || '')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2430; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px 18px; margin: 18px 0; font-size: 12px; }
          .meta div { border: 1px solid #d6deea; border-radius: 8px; padding: 8px 10px; }
          .meta strong { display:block; color:#5f6b84; font-size:11px; margin-bottom:4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d6deea; padding: 8px; text-align: left; }
          th { background: #f5f7fb; }
        </style>
      </head>
      <body>
        <h1>Requerimiento N° ${this.escapeHtml(req.numeroRequerimiento || '-')}</h1>
        <div>Detalle del requerimiento</div>
        <div class="meta">
          <div><strong>Proyecto</strong>${this.escapeHtml(req.nombreProyecto || '-')}</div>
          <div><strong>Solicitante</strong>${this.escapeHtml(this.normalizarNombreSolicitante(req.solicitante || '-'))}</div>
          <div><strong>Fecha</strong>${req.fechaRequerimiento ? new Date(req.fechaRequerimiento).toLocaleDateString('es-PE') : '-'}</div>
          <div><strong>Estado</strong>${this.escapeHtml(req.estado || '-')}</div>
          <div><strong>Especialidades</strong>${this.escapeHtml(req.especialidades || req.especialidad || '-')}</div>
          <div><strong>Fecha entrega</strong>${req.fechaEntrega ? new Date(req.fechaEntrega).toLocaleDateString('es-PE') : '-'}</div>
        </div>
        <table>
          <thead><tr><th>Especialidad</th><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Observación</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin materiales.</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  abrirAccion(accion: AccionFlujo): void {
    this.accionActual = accion;
    this.accionObservacion = '';
    this.accionResultado = 'Conforme';
    this.accionModalOpen = true;
  }

  cerrarAccion(): void {
    if (this.procesandoAccion) return;
    this.accionModalOpen = false;
    this.accionActual = null;
  }

  ejecutarAccion(): void {
    const id = this.detalle?.requerimiento?.idRequerimiento;
    const accion = this.accionActual;
    if (!id || !accion || this.procesandoAccion) return;

    const permitida = accion === 'enviar' ? this.puedeEnviar
      : accion === 'validar-almacen' ? this.puedeProcesarStock
        : accion === 'aprobar' ? this.puedeAprobar
          : accion === 'rechazar' ? this.puedeRechazar
            : this.puedeEnviarCompras;
    if (!permitida) {
      this.notifyService.show('La sesión o el estado actual no permiten esta acción.', 'error');
      return;
    }

    const observacion = this.accionObservacion.trim();
    if ((accion === 'rechazar' || (accion === 'validar-almacen' && this.accionResultado === 'Observado'))
      && !observacion) {
      this.notifyService.show('Debes ingresar una explicación para esta acción.', 'error');
      return;
    }

    // Cada transición usa su endpoint explícito; el PATCH genérico ya no forma parte del contrato.
    const request = accion === 'enviar'
      ? this.requerimientos.enviar(id, { observacion: observacion || null })
      : accion === 'validar-almacen'
        ? this.requerimientos.validarAlmacen(id, { resultado: this.accionResultado, observacion: observacion || null })
        : accion === 'aprobar'
          ? this.requerimientos.aprobar(id, { observacion: observacion || null })
          : accion === 'rechazar'
            ? this.requerimientos.rechazar(id, { observacion })
            : this.requerimientos.enviarCompras(id, { observacion: observacion || null });

    this.procesandoAccion = true;
    request.subscribe({
      next: () => {
        this.procesandoAccion = false;
        this.accionModalOpen = false;
        this.accionActual = null;
        this.notifyService.show('Acción realizada correctamente.', 'success');
        // Se vuelve a consultar el detalle porque los permisos visibles dependen del nuevo estado.
        this.load();
        this.view({ idRequerimiento: id });
      },
      error: (error: unknown) => {
        this.procesandoAccion = false;
        this.notifyService.show(extraerMensajeError(error, 'No se pudo completar la acción.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    this.msg = '';

    if ((!this.editando && !this.puedeCrear)
      || (this.editando && !this.edicionSoloCantidadesAlmacen
        && !this.auth.hasPermission('requerimientos.editar_borrador'))
      || (this.editando && this.edicionSoloCantidadesAlmacen
        && !this.auth.hasPermission('requerimientos.editar_cantidades_almacen'))) {
      this.msg = 'No tienes permiso para guardar este requerimiento.';
      return;
    }

    if (!this.form.numeroRequerimiento?.trim()) {
      this.form.numeroRequerimiento = this.getNextNumeroRequerimiento();
    }
    if (!this.form.fechaRequerimiento) {
      this.form.fechaRequerimiento = this.todayIso();
    }
    if (!this.form.idProyecto) {
      this.msg = 'Debes seleccionar un proyecto.';
      return;
    }
    if (!this.form.fechaEntrega) {
      this.msg = 'Debes ingresar la fecha de entrega.';
      return;
    }
    if (!this.form.items.length) {
      this.msg = 'Debes agregar al menos un ítem.';
      return;
    }

    if (this.edicionSoloCantidadesAlmacen && this.form.items.some((x: any) =>
      !Number.isFinite(Number(x.cantidad)) || Number(x.cantidad) <= 0 || !Number(x.idRequerimientoDetalle))) {
      this.msg = 'Cada ítem debe conservar su detalle y tener una cantidad mayor a cero.';
      return;
    }

    const idEspecialidadBase = this.form.items[0]?.idEspecialidad;
    if (!idEspecialidadBase) {
      this.msg = 'No se pudo determinar la especialidad base del requerimiento.';
      return;
    }

    const dto: RequerimientoRequest = {
      numeroRequerimiento: this.form.numeroRequerimiento.trim(),
      fechaRequerimiento: this.toUtcIso(this.form.fechaRequerimiento),
      idEspecialidad: Number(idEspecialidadBase),
      idProyecto: Number(this.form.idProyecto),
      descripcion: this.form.descripcion ?? '',
      fechaEntrega: this.toUtcIso(this.form.fechaEntrega),
      observacion: this.form.observacion ?? '',
      items: this.form.items.map((x: any) => ({
        idMaterial: Number(x.idMaterial),
        cantidad: Number(x.cantidad),
        observacion: x.observacion ?? '',
        idPresupuestoDetalle: x.idPresupuestoDetalle != null ? Number(x.idPresupuestoDetalle) : null
      }))
    };

    this.saving = true;

    const cantidadesAlmacen: RequerimientoCantidadAlmacenRequest = {
      items: this.form.items.map((x: any) => ({
        idRequerimientoDetalle: Number(x.idRequerimientoDetalle),
        cantidad: Number(x.cantidad)
      }))
    };

    const request: Observable<unknown> = this.editando && this.requerimientoEditandoId
      ? this.edicionSoloCantidadesAlmacen
        ? this.requerimientos.actualizarCantidadesAlmacen(this.requerimientoEditandoId, cantidadesAlmacen)
        : this.requerimientos.actualizar(this.requerimientoEditandoId, dto)
      : this.requerimientos.crear(dto);

    request.subscribe({
      next: () => {
        const idActual = this.requerimientoEditandoId;
        const estabaEditando = this.editando;

        this.saving = false;
        this.msg = estabaEditando
          ? 'Requerimiento actualizado correctamente.'
          : 'Requerimiento creado correctamente.';
        this.notifyService.show(this.msg, 'success');

        this.reset();
        this.formModalOpen = false;
        this.load();

        if (estabaEditando && idActual) {
          this.view({ idRequerimiento: idActual });
        }
      },
      error: (e: any) => {
        this.saving = false;
        this.msg = extraerMensajeError(e, 'No se pudo guardar el requerimiento.');
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reset(): void {
    this.editando = false;
    this.edicionSoloCantidadesAlmacen = false;
    this.requerimientoEditandoId = null;
    this.puedeEditarDetalle = false;
    this.modalEspecialidades = false;
    this.materialFormOpen = false;
    this.msgMaterial = '';
    this.editingItemIndex = null;

    this.form = {
      numeroRequerimiento: '',
      fechaRequerimiento: '',
      idProyecto: null,
      descripcion: '',
      fechaEntrega: '',
      observacion: '',
      items: []
    };

    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: ''
    };
    this.partidasPresupuesto = [];

    this.setFormDefaults(true);
  }

  private setFormDefaults(force = false): void {
    if (this.editando) return;
    if (force || !this.form.numeroRequerimiento) {
      this.form.numeroRequerimiento = this.getNextNumeroRequerimiento();
    }
    if (force || !this.form.fechaRequerimiento) {
      this.form.fechaRequerimiento = this.todayIso();
    }
  }

  private getNextNumeroRequerimiento(): string {
    const max = (this.rows || []).reduce((acc: number, row: any) => Math.max(acc, this.extractNumericValue(row?.numeroRequerimiento)), 0);
    return String(max + 1);
  }

  private extractNumericValue(value: any): number {
    const parts = String(value ?? '').match(/\d+/g);
    if (!parts?.length) return 0;
    return Number(parts.join('')) || 0;
  }

  private todayIso(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private toUtcIso(value: string): string {
    // Los controles date no incluyen zona; se fija medianoche UTC para cumplir el contrato HTTP.
    return new Date(`${value}T00:00:00.000Z`).toISOString();
  }


  getIdEspecialidad(value: any): number | null {
    return Number(value?.idEspecialidad ?? value?.IdEspecialidad ?? null) || null;
  }

  getNombreEspecialidad(value: any): string {
    return String(value?.especialidad ?? value?.Especialidad ?? value?.nombre ?? value?.Nombre ?? '').trim();
  }

  getIdMaterial(value: any): number | null {
    return Number(value?.idMaterial ?? value?.IdMaterial ?? null) || null;
  }

  getDescripcionMaterial(value: any): string {
    return String(value?.descripcion ?? value?.Descripcion ?? value?.material ?? value?.Material ?? '').trim();
  }

  getUnidadMaterial(value: any): string {
    return String(value?.unidadMedida ?? value?.UnidadMedida ?? value?.unidad ?? value?.Unidad ?? '-').trim() || '-';
  }

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private toDateInput(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }
}
