import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../core/services/compras.service';
import { MaestraService } from '../../core/services/maestra.service';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';

type SolicitanteCombo = {
  nombre: string;
  idUsuario: number | null;
  claves: string[];
};

@Component({
  standalone: true,
  selector: 'app-requerimientos-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './requerimientos.page.html',
  styleUrls: ['./requerimientos.page.css']
})
export class RequerimientosPage implements OnInit {
  rows: any[] = [];
  especialidades: any[] = [];
  proyectos: any[] = [];
  materiales: any[] = [];
  unidadesMedida: any[] = [];
  usuarios: any[] = [];
  private readonly solicitantesBase: SolicitanteCombo[] = [
    { nombre: 'Administrador', idUsuario: null, claves: ['administrador'] },
    { nombre: 'Contable', idUsuario: null, claves: ['contable'] },
    { nombre: 'Ingeniero', idUsuario: null, claves: ['ingeniero'] },
    { nombre: 'Jefe de Almacen', idUsuario: null, claves: ['jefe de almacen', 'jefe almacen', 'almacen'] }
  ];
  detalle: any = null;
  formModalOpen = false;
  detalleModalOpen = false;

  filtros: any = {
    estado: '',
    idEspecialidad: null,
    idProyecto: null
  };

  editando = false;
  puedeEditarDetalle = false;
  puedeEnviarOC = false;
  requerimientoEditandoId: number | null = null;

  modalEspecialidades = false;
  materialFormOpen = false;
  savingMaterial = false;
  msgMaterial = '';
  editingItemIndex: number | null = null;
  modalItem = {
    idEspecialidad: null as number | null,
    idMaterial: null as number | null,
    cantidad: 1,
    observacion: ''
  };

  nuevoMaterial = {
    idEspecialidad: null as number | null,
    codigo: '',
    descripcion: '',
    unidadMedida: '',
    stockMinimo: 0,
    activo: true
  };

  form: any = {
    numeroRequerimiento: '',
    fechaRequerimiento: '',
    idProyecto: null,
    descripcion: '',
    fechaEntrega: '',
    idUsuarioSolicitante: null,
    observacion: '',
    items: []
  };

  msg = '';
  saving = false;

  get solicitantesCombo(): SolicitanteCombo[] {
    return this.solicitantesBase.map((item) => ({
      ...item,
      idUsuario: this.buscarIdUsuarioPorSolicitante(item.claves)
    }));
  }

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
    private compras: ComprasService,
    private maestra: MaestraService,
    private seguridad: SeguridadService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  abrirModalNuevo(): void {
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
  }

  load(): void {
    this.compras.requerimientos(this.filtros).subscribe({
      next: (x: any) => {
        this.rows = x ?? [];
        if (!this.editando && !this.form.items.length && !this.form.idProyecto && !this.form.idUsuarioSolicitante) {
          this.setFormDefaults(true);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows = [];
        if (!this.editando && !this.form.items.length && !this.form.idProyecto && !this.form.idUsuarioSolicitante) {
          this.setFormDefaults(true);
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadCatalogos(): void {
    this.maestra.especialidades(true).subscribe({ next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); }, error: () => { this.especialidades = []; this.cdr.detectChanges(); } });
    this.maestra.proyectos(true).subscribe({ next: (x: any) => { this.proyectos = x ?? []; this.cdr.detectChanges(); }, error: () => { this.proyectos = []; this.cdr.detectChanges(); } });
    this.maestra.materiales(true).subscribe({ next: (x: any) => { this.materiales = x ?? []; this.cdr.detectChanges(); }, error: () => { this.materiales = []; this.cdr.detectChanges(); } });
    this.maestra.unidadesMedida(true).subscribe({ next: (x: any) => { this.unidadesMedida = x ?? []; this.cdr.detectChanges(); }, error: () => { this.unidadesMedida = []; this.cdr.detectChanges(); } });
    this.seguridad.usuarios().subscribe({ next: (x: any) => { this.usuarios = x ?? []; this.cdr.detectChanges(); }, error: () => { this.usuarios = []; this.cdr.detectChanges(); } });
  }

  abrirModalEspecialidades(index?: number): void {
    this.msg = '';
    this.modalEspecialidades = true;

    if (index !== undefined && index !== null && index >= 0) {
      const item = this.form.items[index];
      this.editingItemIndex = index;
      this.modalItem = {
        idEspecialidad: item?.idEspecialidad ?? null,
        idMaterial: item?.idMaterial ?? null,
        cantidad: Number(item?.cantidad ?? 1),
        observacion: item?.observacion ?? ''
      };
      return;
    }

    this.editingItemIndex = null;
    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      cantidad: 1,
      observacion: ''
    };
  }

  cerrarModalEspecialidades(): void {
    this.modalEspecialidades = false;
    this.materialFormOpen = false;
    this.msgMaterial = '';
    this.editingItemIndex = null;
    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      cantidad: 1,
      observacion: ''
    };
  }

  onModalEspecialidadChange(): void {
    this.modalItem.idMaterial = null;
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
      descripcion: '',
      unidadMedida: '',
      stockMinimo: 0,
      activo: true
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
      descripcion: (this.nuevoMaterial.descripcion ?? '').toString().trim(),
      unidadMedida: (this.nuevoMaterial.unidadMedida ?? '').toString().trim(),
      stockMinimo: Number(this.nuevoMaterial.stockMinimo ?? 0) || 0,
      activo: true
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
      observacion: this.modalItem.observacion ?? ''
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
    this.compras.requerimiento(row.idRequerimiento).subscribe({
      next: (x: any) => {
        this.detalle = x;
        this.puedeEditarDetalle = !!x?.puedeEditar;
        const estado = (x?.requerimiento?.estado || '').toUpperCase();
        this.puedeEnviarOC = estado === 'REGISTRADO';
        this.detalleModalOpen = true;
        this.formModalOpen = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detalle = null;
        this.puedeEditarDetalle = false;
        this.puedeEnviarOC = false;
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
    this.requerimientoEditandoId = req.idRequerimiento;

    this.form = {
      numeroRequerimiento: req.numeroRequerimiento ?? '',
      fechaRequerimiento: this.toDateInput(req.fechaRequerimiento),
      idProyecto: req.idProyecto ?? null,
      descripcion: req.descripcion ?? '',
      fechaEntrega: this.toDateInput(req.fechaEntrega),
      idUsuarioSolicitante: req.idUsuarioSolicitante ?? null,
      observacion: req.observacion ?? '',
      items: items.map((x: any) => ({
        idMaterial: x.idMaterial,
        idEspecialidad: x.idEspecialidad ?? null,
        especialidad: x.especialidad ?? '',
        material: x.material,
        unidadMedida: x.unidadMedida ?? x.unidad ?? '-',
        cantidad: Number(x.cantidad),
        observacion: x.observacion ?? ''
      }))
    };

    this.msg = 'Editando requerimiento.';
    this.formModalOpen = true;
    this.detalleModalOpen = false;
    this.cdr.detectChanges();
  }




  nombreUsuarioSolicitante(usuario: any): string {
    const nombres = String(usuario?.nombres ?? usuario?.Nombres ?? '').trim();
    const apellidos = String(usuario?.apellidos ?? usuario?.Apellidos ?? '').trim();
    return this.normalizarNombreSolicitante(`${nombres} ${apellidos}`);
  }

  private buscarIdUsuarioPorSolicitante(claves: string[]): number | null {
    const usuario = (this.usuarios || []).find((u: any) => {
      const nombre = this.normalizarTexto(`${u?.nombres ?? u?.Nombres ?? ''} ${u?.apellidos ?? u?.Apellidos ?? ''}`);
      return claves.some((clave) => nombre.includes(this.normalizarTexto(clave)));
    });

    const id = Number(usuario?.idUsuario ?? usuario?.IdUsuario ?? 0);
    return id > 0 ? id : null;
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

  enviarAOC(): void {
    const id = this.detalle?.requerimiento?.idRequerimiento;
    if (!id) return;

    const usuario = this.usuarios?.[0];
    const idUsuario = usuario?.idUsuario ?? null;

    this.compras.enviarAOrdenCompra(id, idUsuario).subscribe({
      next: () => {
        this.msg = 'Requerimiento enviado a orden de compra.';
        this.notifyService.show(this.msg, 'success');
        this.load();
        this.view({ idRequerimiento: id });
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo enviar a orden de compra.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    this.msg = '';

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
    if (!this.form.idUsuarioSolicitante) {
      this.msg = 'Debes seleccionar un solicitante.';
      return;
    }
    if (!this.form.items.length) {
      this.msg = 'Debes agregar al menos un ítem.';
      return;
    }

    const idEspecialidadBase = this.form.items[0]?.idEspecialidad;
    if (!idEspecialidadBase) {
      this.msg = 'No se pudo determinar la especialidad base del requerimiento.';
      return;
    }

    const dto = {
      numeroRequerimiento: this.form.numeroRequerimiento.trim(),
      fechaRequerimiento: this.form.fechaRequerimiento,
      idEspecialidad: Number(idEspecialidadBase),
      idProyecto: Number(this.form.idProyecto),
      descripcion: this.form.descripcion ?? '',
      fechaEntrega: this.form.fechaEntrega || null,
      idUsuarioSolicitante: Number(this.form.idUsuarioSolicitante),
      observacion: this.form.observacion ?? '',
      items: this.form.items.map((x: any) => ({
        idMaterial: Number(x.idMaterial),
        cantidad: Number(x.cantidad),
        observacion: x.observacion ?? ''
      }))
    };

    this.saving = true;

    const request = this.editando && this.requerimientoEditandoId
      ? this.compras.actualizarRequerimiento(this.requerimientoEditandoId, dto)
      : this.compras.crearRequerimiento(dto);

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
        this.msg = e?.error?.message || 'No se pudo guardar el requerimiento.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reset(): void {
    this.editando = false;
    this.requerimientoEditandoId = null;
    this.puedeEditarDetalle = false;
    this.puedeEnviarOC = false;
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
      idUsuarioSolicitante: null,
      observacion: '',
      items: []
    };

    this.modalItem = {
      idEspecialidad: null,
      idMaterial: null,
      cantidad: 1,
      observacion: ''
    };

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
