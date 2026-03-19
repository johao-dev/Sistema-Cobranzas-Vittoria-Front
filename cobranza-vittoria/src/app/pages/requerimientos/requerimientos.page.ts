import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../core/services/compras.service';
import { MaestraService } from '../../core/services/maestra.service';
import { SeguridadService } from '../../core/services/seguridad.service';

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
  usuarios: any[] = [];
  detalle: any = null;

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
  editingItemIndex: number | null = null;
  modalItem = {
    idEspecialidad: null as number | null,
    idMaterial: null as number | null,
    cantidad: 1,
    observacion: ''
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

  get especialidadesSeleccionadas(): string[] {
    const values = (this.form.items || [])
      .map((x: any) => (x.especialidad || '').trim())
      .filter((x: string) => !!x);
    return Array.from(new Set(values));
  }

  get materialesFiltradosModal(): any[] {
    if (!this.modalItem.idEspecialidad) return [];
    return (this.materiales || []).filter((m: any) => Number(m.idEspecialidad) === Number(this.modalItem.idEspecialidad));
  }

  constructor(
    private compras: ComprasService,
    private maestra: MaestraService,
    private seguridad: SeguridadService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadCatalogos();
  }

  load(): void {
    this.compras.requerimientos(this.filtros).subscribe({
      next: (x: any) => this.rows = x ?? [],
      error: () => this.rows = []
    });
  }

  loadCatalogos(): void {
    this.maestra.especialidades(true).subscribe({ next: (x: any) => this.especialidades = x ?? [], error: () => this.especialidades = [] });
    this.maestra.proyectos(true).subscribe({ next: (x: any) => this.proyectos = x ?? [], error: () => this.proyectos = [] });
    this.maestra.materiales(true).subscribe({ next: (x: any) => this.materiales = x ?? [], error: () => this.materiales = [] });
    this.seguridad.usuarios().subscribe({ next: (x: any) => this.usuarios = x ?? [], error: () => this.usuarios = [] });
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

    const material = this.materiales.find((m: any) => m.idMaterial === Number(this.modalItem.idMaterial));
    const especialidad = this.especialidades.find((e: any) => e.idEspecialidad === Number(this.modalItem.idEspecialidad));

    const nuevoItem = {
      idMaterial: Number(this.modalItem.idMaterial),
      idEspecialidad: Number(this.modalItem.idEspecialidad),
      especialidad: material?.especialidad ?? especialidad?.nombre ?? '',
      material: material?.descripcion ?? '',
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
      },
      error: () => {
        this.detalle = null;
        this.puedeEditarDetalle = false;
        this.puedeEnviarOC = false;
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
        cantidad: Number(x.cantidad),
        observacion: x.observacion ?? ''
      }))
    };

    this.msg = 'Editando requerimiento.';
  }

  enviarAOC(): void {
    const id = this.detalle?.requerimiento?.idRequerimiento;
    if (!id) return;

    const usuario = this.usuarios?.[0];
    const idUsuario = usuario?.idUsuario ?? null;

    this.compras.enviarAOrdenCompra(id, idUsuario).subscribe({
      next: () => {
        this.msg = 'Requerimiento enviado a orden de compra.';
        this.load();
        this.view({ idRequerimiento: id });
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo enviar a orden de compra.';
      }
    });
  }

  save(): void {
    this.msg = '';

    if (!this.form.numeroRequerimiento?.trim()) {
      this.msg = 'Debes ingresar el número de requerimiento.';
      return;
    }
    if (!this.form.fechaRequerimiento) {
      this.msg = 'Debes ingresar la fecha del requerimiento.';
      return;
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
      this.msg = 'Debes agregar al menos un item.';
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

        this.reset();
        this.load();

        if (estabaEditando && idActual) {
          this.view({ idRequerimiento: idActual });
        }
      },
      error: (e: any) => {
        this.saving = false;
        this.msg = e?.error?.message || 'No se pudo guardar el requerimiento.';
      }
    });
  }

  reset(): void {
    this.editando = false;
    this.requerimientoEditandoId = null;
    this.puedeEditarDetalle = false;
    this.puedeEnviarOC = false;
    this.modalEspecialidades = false;
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
  }

  private toDateInput(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }
}
