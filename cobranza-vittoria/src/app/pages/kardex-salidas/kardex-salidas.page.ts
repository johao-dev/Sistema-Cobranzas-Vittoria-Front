import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { MaestraService } from '../../core/services/maestra.service';
import { KardexService } from '../../core/services/kardex.service';

@Component({
  standalone: true,
  selector: 'app-kardex-salidas-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex-salidas.page.html',
  styleUrl: './kardex-salidas.page.css'
})
export class KardexSalidasPage implements OnInit {
  modalOpen = false;

  abrirModalNuevo(): void {
    this.reset();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  rows: any[] = [];
  filtroBusqueda = '';

  filtros = {
    idEspecialidad: null as number | null,
    idProyecto: null as number | null,
    fechaDesde: '',
    fechaHasta: ''
  };

  private normalizarBusqueda(valor: any): string {
    return (valor ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizarBusqueda(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];

    return (this.rows ?? []).filter(row =>
      this.normalizarBusqueda(Object.values(row ?? {}).join(' ')).includes(termino)
    );
  }

  especialidades: any[] = [];
  proyectos: any[] = [];
  materiales: any[] = [];
  materialesFiltradosModal: any[] = [];
  msg = '';

  modalItemOpen = false;
  editingItemIndex: number | null = null;
  modalItem: any = this.crearModalItemVacio();
  modalItemMsg = '';

  form: any = this.crearFormVacio();

  get modalItemCantidadInvalida(): boolean {
    const n = Number(this.modalItem?.cantidad);
    return !Number.isFinite(n) || n < 0;
  }

  get itemsInvalidos(): boolean {
    return (this.form?.items || []).some((it: any) => !it.idMaterial || !(Number(it.cantidad) >= 0));
  }

  constructor(
    private maestra: MaestraService,
    private kardex: KardexService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.maestra.especialidades(true).subscribe({
      next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.especialidades = []; this.cdr.detectChanges(); }
    });

    this.maestra.proyectos(true).subscribe({
      next: (x: any) => { this.proyectos = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });

    this.maestra.materiales(true).subscribe({
      next: (x: any) => { this.materiales = x ?? []; this.actualizarMaterialesFiltrados(); this.cdr.detectChanges(); },
      error: () => { this.materiales = []; this.materialesFiltradosModal = []; this.cdr.detectChanges(); }
    });

    this.load();
  }

  load() {
    this.kardex.salidas({
      idEspecialidad: this.filtros.idEspecialidad,
      idProyecto: this.filtros.idProyecto,
      fechaDesde: this.filtros.fechaDesde || null,
      fechaHasta: this.filtros.fechaHasta || null
    }).subscribe({
      next: (x: any) => {
        this.rows = (x || []).map((row: any) => this.normalizarSalida(row));
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows = [];
        this.cdr.detectChanges();
      }
    });
  }

  limpiarFiltros() {
    this.filtros = {
      idEspecialidad: null,
      idProyecto: null,
      fechaDesde: '',
      fechaHasta: ''
    };
    this.load();
  }

  edit(row: any) {
    this.modalOpen = true;
    this.form = this.normalizarSalida(row);
    this.msg = '';
    this.actualizarMaterialesFiltrados();
    this.cdr.detectChanges();
  }

  delete(row: any) {
    const id = this.toNumberOrNull(this.read(row, ['idKardexSalida', 'IdKardexSalida', 'id', 'Id']));
    if (!id) {
      this.notifyService.show('No se pudo identificar el registro a eliminar.', 'error');
      return;
    }

    const items = (this.form.items || []);
    const cantidadItems = items.length;
    const primerNombre = items[0]?.nombre || '';
    const detalle = cantidadItems > 1
      ? `esta salida con ${cantidadItems} ítems`
      : (primerNombre ? `la salida de "${primerNombre}"` : 'esta salida');
    if (!confirm(`¿Eliminar ${detalle}? Esta acción no se puede deshacer.`)) return;

    this.kardex.eliminarSalida(id).subscribe({
      next: () => {
        this.notifyService.show('Salida eliminada correctamente.', 'success');
        this.load();
      },
      error: (e: any) => {
        this.notifyService.show(e?.error?.message || 'No se pudo eliminar la salida.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reset() {
    this.form = this.crearFormVacio();
    this.msg = '';
    this.cerrarModalItem();
    this.cdr.detectChanges();
  }

  abrirModalItem() {
    if (!this.form.idEspecialidad) {
      this.msg = 'Selecciona primero una especialidad.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    this.editingItemIndex = null;
    this.modalItem = this.crearModalItemVacio();
    this.modalItemMsg = '';
    this.modalItemOpen = true;
    this.actualizarMaterialesFiltrados();
    this.cdr.detectChanges();
  }

  editarItem(index: number) {
    const it = this.form.items?.[index];
    if (!it) return;
    this.editingItemIndex = index;
    this.modalItem = {
      idMaterial: this.toNumberOrNull(it.idMaterial),
      cantidad: Number(it.cantidad || 0),
      observacion: it.observacion ?? ''
    };
    this.modalItemMsg = '';
    this.modalItemOpen = true;
    this.actualizarMaterialesFiltrados();
    this.cdr.detectChanges();
  }

  eliminarItem(index: number) {
    if (!confirm('¿Quitar este ítem de la salida?')) return;
    this.form.items.splice(index, 1);
    this.cdr.detectChanges();
  }

  cerrarModalItem() {
    this.modalItemOpen = false;
    this.editingItemIndex = null;
    this.modalItem = this.crearModalItemVacio();
    this.modalItemMsg = '';
    this.cdr.detectChanges();
  }

  agregarItemDesdeModal() {
    this.modalItemMsg = '';

    const idMat = this.toNumberOrNull(this.modalItem.idMaterial);
    if (!idMat) {
      this.modalItemMsg = 'Debes seleccionar un material.';
      this.notifyService.show(this.modalItemMsg, 'error');
      return;
    }

    const cantidad = Number(this.modalItem.cantidad);
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      this.modalItemMsg = 'La cantidad debe ser mayor o igual a 0.';
      this.notifyService.show(this.modalItemMsg, 'error');
      return;
    }

    const material = this.materiales.find((m: any) => this.getIdMaterial(m) === idMat);
    if (!material) {
      this.modalItemMsg = 'El material seleccionado no se encontró.';
      this.notifyService.show(this.modalItemMsg, 'error');
      return;
    }

    const nuevoItem = {
      idMaterial: idMat,
      codigoMaterial: this.getCodigoMaterial(material) ?? '',
      nombre: this.getDescripcionMaterial(material) ?? '',
      unidadMedida: this.getUnidadMaterial(material) ?? '',
      cantidad,
      observacion: (this.modalItem.observacion ?? '').toString().trim()
    };

    if (!this.form.items) this.form.items = [];

    if (this.editingItemIndex !== null && this.editingItemIndex >= 0 && this.editingItemIndex < this.form.items.length) {
      this.form.items[this.editingItemIndex] = nuevoItem;
    } else {
      this.form.items.push(nuevoItem);
    }

    this.cerrarModalItem();
  }

  onModalMaterialChange() {
    // reservado para lógica futura; el modal-item solo guarda idMaterial
  }

  onModalCantidadInput() {
    const n = Number(this.modalItem.cantidad);
    if (this.modalItem.cantidad !== null && this.modalItem.cantidad !== undefined && this.modalItem.cantidad !== '' && (Number.isNaN(n) || n < 0)) {
      this.modalItem.cantidad = 0;
    }
  }

  actualizarMaterialesFiltrados() {
    const idEsp = this.form?.idEspecialidad;
    if (!idEsp) {
      this.materialesFiltradosModal = [];
      return;
    }
    this.materialesFiltradosModal = (this.materiales || []).filter((m: any) => {
      const idMatEsp = this.read(m, ['idEspecialidad', 'IdEspecialidad', 'especialidadId', 'EspecialidadId']);
      return idMatEsp == null ? true : Number(idMatEsp) === Number(idEsp);
    });
  }

  getIdMaterial(m: any): number | null {
    return this.toNumberOrNull(this.read(m, ['idMaterial', 'IdMaterial', 'id', 'Id']));
  }

  getDescripcionMaterial(m: any): string {
    return this.read(m, ['nombre', 'Nombre', 'descripcion', 'Descripcion']) ?? '';
  }

  getCodigoMaterial(m: any): string {
    return this.read(m, ['codigo', 'Codigo', 'codigoMaterial', 'CodigoMaterial']) ?? '';
  }

  getUnidadMaterial(m: any): string {
    const unidad = this.read(m, ['unidadMedida', 'UnidadMedida', 'unidad', 'Unidad', 'abreviatura', 'Abreviatura']);
    if (unidad && typeof unidad === 'object') {
      return this.read(unidad, ['nombre', 'Nombre', 'abreviatura', 'Abreviatura', 'codigo', 'Codigo']) ?? '';
    }
    return unidad ?? '';
  }

  save() {
    const items = (this.form.items || []).map((x: any) => ({
      idMaterial: x.idMaterial != null ? Number(x.idMaterial) : null,
      cantidad: Number(x.cantidad || 0),
      observacion: (x.observacion ?? '').toString().trim()
    }));

    const payload = {
      idKardexSalida: this.form.idKardexSalida ? Number(this.form.idKardexSalida) : null,
      idEspecialidad: this.form.idEspecialidad != null ? Number(this.form.idEspecialidad) : null,
      numeroDocumento: (this.form.numeroDocumento ?? '').toString().trim(),
      fecha: this.form.fecha || null,
      solicitante: (this.form.solicitante ?? '').toString().trim(),
      observacion: (this.form.observacion ?? '').toString().trim(),
      items
    };

    if (!payload.idEspecialidad) {
      this.msg = 'Debes seleccionar una especialidad.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (!payload.solicitante) {
      this.msg = 'Debes ingresar el solicitante.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (!payload.fecha) {
      this.msg = 'Debes seleccionar la fecha.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (!items.length) {
      this.msg = 'Debes agregar al menos un ítem con material y cantidad.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (items.some((it: any) => !it.idMaterial || !(it.cantidad >= 0))) {
      this.msg = 'Revisa los ítems: cada uno debe tener material y cantidad mayor o igual a 0.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    this.kardex.guardarSalida(payload).subscribe({
      next: (resp: any) => {
        this.msg = payload.idKardexSalida
          ? 'Salida actualizada correctamente.'
          : 'Salida registrada correctamente.';
        this.notifyService.show(this.msg, 'success');
        this.reset();
        this.cerrarModal();
        this.load();
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo guardar la salida.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  formatFecha(value: any): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-PE');
  }

  formatCantidad(value: any): string {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  getProyectoLabel(p: any): string {
    return this.read(p, ['nombre', 'Nombre', 'nombreProyecto', 'NombreProyecto']) ?? '';
  }

  private crearFormVacio(): any {
    return {
      idKardexSalida: null,
      idEspecialidad: null,
      numeroDocumento: '',
      fecha: new Date().toISOString().slice(0, 10),
      solicitante: '',
      observacion: '',
      items: [] as any[]
    };
  }

  private crearModalItemVacio(): any {
    return {
      idMaterial: null as number | null,
      cantidad: 0,
      observacion: ''
    };
  }

  private normalizarSalida(row: any): any {
    if (!row) return this.crearFormVacio();

    // Si el backend devuelve items[], los usamos. Si no, creamos uno a partir del registro single-item (compatibilidad).
    let items: any[] = [];
    const itemsRaw = this.read(row, ['items', 'Items', 'detalles', 'Detalles']);
    if (Array.isArray(itemsRaw) && itemsRaw.length) {
      items = itemsRaw.map((it: any) => this.normalizarItem(it));
    } else {
      const item = this.normalizarItem(row);
      if (item.idMaterial || item.codigoMaterial || item.nombre) items = [item];
    }

    return {
      idKardexSalida: this.toNumberOrNull(this.read(row, ['idKardexSalida', 'IdKardexSalida', 'id', 'Id'])),
      idEspecialidad: this.toNumberOrNull(this.read(row, ['idEspecialidad', 'IdEspecialidad'])),
      especialidad: this.read(row, ['especialidad', 'Especialidad', 'nombreEspecialidad', 'NombreEspecialidad']) ?? '',
      numeroDocumento: this.read(row, ['numeroDocumento', 'NumeroDocumento', 'nroDocumento', 'NroDocumento']) ?? '',
      fecha: this.formatFechaInput(this.read(row, ['fecha', 'Fecha'])),
      solicitante: this.read(row, ['solicitante', 'Solicitante']) ?? '',
      observacion: this.read(row, ['observacion', 'Observacion', 'observaciones', 'Observaciones']) ?? '',
      items
    };
  }

  private normalizarItem(row: any): any {
    if (!row) return { idMaterial: null, codigoMaterial: '', nombre: '', unidadMedida: '', cantidad: 0, observacion: '' };
    return {
      idMaterial: this.toNumberOrNull(this.read(row, ['idMaterial', 'IdMaterial'])),
      codigoMaterial: this.read(row, ['codigoMaterial', 'CodigoMaterial', 'codigo', 'Codigo']) ?? '',
      nombre: this.read(row, ['nombre', 'Nombre', 'material', 'Material', 'descripcion', 'Descripcion']) ?? '',
      unidadMedida: this.read(row, ['unidadMedida', 'UnidadMedida', 'unidad', 'Unidad', 'abreviatura', 'Abreviatura']) ?? '',
      cantidad: this.toNumberOrDefault(this.read(row, ['cantidad', 'Cantidad']), 0),
      observacion: this.read(row, ['observacion', 'Observacion', 'observaciones', 'Observaciones']) ?? ''
    };
  }

  private formatFechaInput(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }

  private read(obj: any, keys: string[]): any {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    const lowerMap = Object.keys(obj).reduce((acc: any, key: string) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
    for (const key of keys) {
      const value = lowerMap[key.toLowerCase()];
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  private toNumberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toNumberOrDefault(value: any, fallback: number): number {
    const n = this.toNumberOrNull(value);
    return n === null ? fallback : n;
  }
}
