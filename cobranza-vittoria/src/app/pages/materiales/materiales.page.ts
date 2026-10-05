import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';

import { MaestraService } from '../../core/services/maestra.service';
import { ApiService } from '../../core/services/api.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { ImportModalComponent } from '../../shared/components/import-modal/import-modal.component';
import {
  MaterialPlantillaFormato,
  MATERIAL_PLANTILLA_FORMATOS
} from '../../models/import.models';

@Component({
  standalone: true,
  selector: 'app-materiales-page',
  imports: [CommonModule, FormsModule, ImportModalComponent],
  templateUrl: './materiales.page.html',
  styleUrl: './materiales.page.css'
})
export class MaterialesPage implements OnInit {
  modalOpen = false;
  importOpen = false;
  importFormato: MaterialPlantillaFormato = 'xlsx';
  readonly formatosPlantilla = MATERIAL_PLANTILLA_FORMATOS;
  cargandoCodigoMaterial = false;

  abrirModalNuevo(): void {
    this.reset(false);
    this.modalOpen = true;
    this.cargarSiguienteCodigoMaterial();
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  abrirImportModal(): void {
    this.importOpen = true;
    this.cdr.detectChanges();
  }

  cerrarImportModal(): void {
    this.importOpen = false;
    this.cdr.detectChanges();
  }

  onImportSuccess(): void {
    this.cerrarImportModal();
    this.load();
  }

  rows: any[] = [];
  filtroBusqueda = '';

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
  unidadesMedida: any[] = [];
  filtroEspecialidad: number | null = null;
  msg = '';

  form: any = this.crearFormVacio();

  /** Partidas hoja activas: las únicas que pueden ser partida por defecto de un material. */
  partidas: any[] = [];

  constructor(
    private maestra: MaestraService,
    private api: ApiService,
    private controlPresupuestario: ControlPresupuestarioService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.maestra.especialidades(true).subscribe(x => {
      this.especialidades = x || [];
      this.cdr.detectChanges();
    });

    this.maestra.unidadesMedida(true).subscribe(x => {
      this.unidadesMedida = x || [];
      this.cdr.detectChanges();
    });

    // Sin permiso sobre Control Presupuestario el selector queda vacío y el
    // material se guarda sin partida, como antes.
    this.controlPresupuestario.partidas({ activo: true, esHoja: true }).subscribe({
      next: x => {
        this.partidas = x || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.partidas = [];
        this.cdr.detectChanges();
      }
    });

    this.load();
  }

  load() {
    this.maestra.materiales(undefined, this.filtroEspecialidad).subscribe(x => {
      this.rows = (x || []).map((row: any) => this.normalizarMaterial(row));
      this.cdr.detectChanges();
    });
  }

  get codigoMaterialVisible(): string {
    const codigo = this.getCodigoMaterial(this.form);

    if (codigo) return codigo;
    if (this.cargandoCodigoMaterial) return 'Calculando...';

    return this.form?.idMaterial ? '-' : 'Calculando...';
  }

  getCodigoMaterial(row: any): string {
    return String(
      this.read(row, [
        'codigo',
        'Codigo',
        'codigoMaterial',
        'CodigoMaterial',
        'codMaterial',
        'CodMaterial'
      ]) ?? ''
    ).trim();
  }

  onEspecialidadChange(idEspecialidad: any): void {
    this.form.idEspecialidad = idEspecialidad != null && idEspecialidad !== ''
      ? Number(idEspecialidad)
      : null;

    if (!this.form.idMaterial) {
      this.cargarSiguienteCodigoMaterial();
    }
  }

  edit(row: any) {
    this.modalOpen = true;
    this.cargandoCodigoMaterial = false;
    this.form = this.normalizarMaterial(row);
    this.msg = '';
    this.cdr.detectChanges();

    const idMaterial = this.form.idMaterial;
    if (idMaterial) {
      this.maestra.material(idMaterial).subscribe({
        next: (detalle: any) => {
          this.form = {
            ...this.form,
            ...this.normalizarMaterial(detalle),
            idMaterial
          };
          this.cdr.detectChanges();
        },
        error: () => {
          this.cdr.detectChanges();
        }
      });
    }
  }

  reset(cargarCodigo = true) {
    this.form = this.crearFormVacio();
    this.msg = '';

    if (cargarCodigo) {
      this.cargarSiguienteCodigoMaterial();
    }
  }

  save() {
    const payload = {
      idMaterial: this.form.idMaterial ? Number(this.form.idMaterial) : null,
      idEspecialidad: this.form.idEspecialidad != null ? Number(this.form.idEspecialidad) : 0,
      codigo: this.form.idMaterial ? this.getCodigoMaterial(this.form) : '',
      codigoProveedor: (this.form.codigoProveedor ?? '').toString().trim(),
      descripcion: (this.form.descripcion ?? '').toString().trim(),
      unidadMedida: (this.form.unidadMedida ?? '').toString().trim(),
      idCatalogoPartida: this.form.idCatalogoPartida || null,
      stockMinimo: this.form.stockMinimo != null && this.form.stockMinimo !== ''
        ? Number(this.form.stockMinimo)
        : 0,
      activo: !!this.form.activo
    };

    if (!payload.idEspecialidad || payload.idEspecialidad <= 0) {
      this.msg = 'Debes seleccionar una especialidad válida.';
      return;
    }

    if (!payload.descripcion) {
      this.msg = 'Debes ingresar la descripción.';
      return;
    }

    if (!payload.unidadMedida) {
      this.msg = 'Debes seleccionar la unidad de medida.';
      return;
    }

    this.maestra.guardarMaterial(payload).subscribe({
      next: () => {
        this.msg = payload.idMaterial
          ? 'Material actualizado correctamente.'
          : 'Material guardado correctamente.';

        this.notifyService.show(this.msg, 'success');

        this.reset(false);
        this.cerrarModal();
        this.load();
        this.cdr.detectChanges();
      },
      error: e => {
        console.log('ERROR GUARDAR MATERIAL', e);
        console.log('PAYLOAD MATERIAL', payload);

        const apiErrors = e?.error?.errors;
        if (apiErrors) {
          const mensajes = Object.values(apiErrors).flat().join(' ');
          this.msg = mensajes || 'No se pudo guardar el material.';
          this.cdr.detectChanges();
          return;
        }

        this.msg = e?.error?.message || 'No se pudo guardar el material.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  private cargarSiguienteCodigoMaterial(): void {
    if (this.form?.idMaterial) return;

    this.cargandoCodigoMaterial = true;
    this.form.codigo = '';
    this.cdr.detectChanges();

    this.api.http.get<any>(`${this.api.baseUrl}/api/maestra/materiales/siguiente-codigo`).subscribe({
      next: (res: any) => {
        const codigo = this.getCodigoMaterial(res);
        this.form.codigo = codigo;
        this.cargandoCodigoMaterial = false;
        this.cdr.detectChanges();
      },
      error: e => {
        console.log('ERROR OBTENER SIGUIENTE CÓDIGO MATERIAL', e);
        this.cargandoCodigoMaterial = false;
        this.cdr.detectChanges();
      }
    });
  }

  private crearFormVacio(): any {
    return {
      idMaterial: null,
      idEspecialidad: null,
      codigo: '',
      codigoProveedor: '',
      descripcion: '',
      unidadMedida: '',
      stockMinimo: 0,
      activo: true,
      idCatalogoPartida: '',
      codigoPartida: '',
      nombrePartida: ''
    };
  }

  /**
   * Opciones del selector de partida. Si el material tiene una partida que ya no
   * está disponible (inactiva o con hijas), se agrega para no perderla al editar.
   */
  get partidasOpciones(): any[] {
    const actual = this.form?.idCatalogoPartida;
    if (!actual || this.partidas.some(p => Number(p.idCatalogoPartida) === Number(actual))) return this.partidas;
    return [...this.partidas, {
      idCatalogoPartida: Number(actual),
      codigo: this.form.codigoPartida || '?',
      nombre: `${this.form.nombrePartida || 'Partida'} (no disponible)`
    }];
  }

  private normalizarMaterial(row: any): any {
    if (!row) return this.crearFormVacio();

    return {
      idMaterial: this.toNumberOrNull(this.read(row, ['idMaterial', 'IdMaterial', 'id', 'Id'])),
      idEspecialidad: this.toNumberOrNull(this.read(row, ['idEspecialidad', 'IdEspecialidad'])),
      especialidad: this.read(row, ['especialidad', 'Especialidad']) ?? '',
      codigo: this.getCodigoMaterial(row),
      codigoProveedor: this.read(row, ['codigoProveedor', 'CodigoProveedor']) ?? '',
      descripcion: this.read(row, ['descripcion', 'Descripcion', 'material', 'Material']) ?? '',
      unidadMedida: this.read(row, ['unidadMedida', 'UnidadMedida', 'unidad', 'Unidad']) ?? '',
      stockMinimo: this.toNumberOrDefault(this.read(row, ['stockMinimo', 'StockMinimo']), 0),
      activo: this.read(row, ['activo', 'Activo']) ?? true,
      idCatalogoPartida: this.toNumberOrNull(this.read(row, ['idCatalogoPartida', 'IdCatalogoPartida'])) ?? '',
      codigoPartida: this.read(row, ['codigoPartida', 'CodigoPartida']) ?? '',
      nombrePartida: this.read(row, ['nombrePartida', 'NombrePartida']) ?? ''
    };
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
