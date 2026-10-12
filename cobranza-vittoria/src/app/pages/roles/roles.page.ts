import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';
import { Permiso } from '../../models/permisos.models';
import { extraerMensajeError } from '../../core/utils/api-error.util';
import { forkJoin } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-roles-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.css'
})
export class RolesPage implements OnInit {
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
  permisos: Permiso[] = [];
  permisosAsignados: Permiso[] = [];
  idsPermisosSeleccionados = new Set<number>();
  guardandoPermisos = false;
  cargandoDetalleRol = false;
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

  filtroActivo: boolean | null = null;
  msg = '';
  form: any = { idRol: null, nombreRol: '', descripcion: '', activo: true };

  constructor(
    private seguridad: SeguridadService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.load();
  }

  load() {
    this.seguridad.roles(this.filtroActivo).subscribe(x => {
      this.rows = x || [];
      this.cdr.detectChanges();
    });
  }

  edit(row: any) {
    this.modalOpen = true;
    this.cargandoDetalleRol = true;
    this.permisos = [];
    this.idsPermisosSeleccionados = new Set<number>();
    this.form = {
      idRol: row.idRol ?? null,
      nombreRol: row.nombreRol ?? row.nombre ?? '',
      descripcion: row.descripcion ?? '',
      activo: row.activo ?? true
    };
    const idRol = Number(this.form.idRol);
    if (!idRol) return;

    forkJoin({
      permisosDisponibles: this.seguridad.permisos(true),
      rol: this.seguridad.obtenerRolConPermisos(idRol)
    }).subscribe({
      next: ({ permisosDisponibles, rol }) => {
        this.form = {
          idRol: rol.idRol,
          nombreRol: rol.nombre,
          descripcion: rol.descripcion,
          activo: rol.activo
        };
        this.permisos = permisosDisponibles.permisos ?? [];
        this.idsPermisosSeleccionados = new Set(rol.permisos.map(permiso => permiso.idPermiso));
        this.permisosAsignados = this.permisos.filter(permiso => this.idsPermisosSeleccionados.has(permiso.idPermiso));
        this.cargandoDetalleRol = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.cargandoDetalleRol = false;
        this.notifyService.show(extraerMensajeError(error, 'No se pudo cargar el detalle del rol.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reset() {
    this.form = { idRol: null, nombreRol: '', descripcion: '', activo: true };
    this.msg = '';
    this.permisos = [];
    this.permisosAsignados = [];
    this.idsPermisosSeleccionados = new Set<number>();
    this.cargandoDetalleRol = false;
  }

  save() {
    const payload = {
      idRol: this.form.idRol ? Number(this.form.idRol) : null,
      nombre: (this.form.nombreRol ?? '').toString().trim(),
      descripcion: (this.form.descripcion ?? '').toString().trim(),
      activo: !!this.form.activo
    };

    if (!payload.nombre) {
      this.msg = 'Debes ingresar el nombre del rol.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    this.seguridad.guardarRol(payload).subscribe({
      next: () => {
        this.msg = payload.idRol ? 'Rol actualizado correctamente.' : 'Rol guardado correctamente.';
        this.notifyService.show(this.msg, 'success');
        this.reset();
        this.cerrarModal();
        this.load();
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo guardar el rol.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  permisoSeleccionado(idPermiso: number): boolean {
    return this.idsPermisosSeleccionados.has(idPermiso);
  }

  togglePermiso(idPermiso: number, selected: boolean): void {
    if (selected) this.idsPermisosSeleccionados.add(idPermiso);
    else this.idsPermisosSeleccionados.delete(idPermiso);
  }

  asignarPermisos(): void {
    const idRol = Number(this.form.idRol);
    if (!idRol || !this.idsPermisosSeleccionados.size || this.guardandoPermisos) {
      this.notifyService.show('Para quitar todos los permisos, usa el botón × de cada permiso asignado.', 'info');
      return;
    }

    this.guardandoPermisos = true;
    this.seguridad.asignarPermisosRol(idRol, [...this.idsPermisosSeleccionados]).subscribe({
      next: () => {
        this.guardandoPermisos = false;
        this.permisosAsignados = this.permisos.filter(permiso => this.idsPermisosSeleccionados.has(permiso.idPermiso));
        this.notifyService.show('Permisos asignados. Vuelve a iniciar sesión para actualizar los claims.', 'success', 5000);
        this.cdr.detectChanges();
      },
      error: error => {
        this.guardandoPermisos = false;
        this.notifyService.show(extraerMensajeError(error, 'No se pudieron asignar los permisos.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  quitarPermiso(permiso: Permiso): void {
    const idRol = Number(this.form.idRol);
    if (!idRol || !permiso.idPermiso) return;

    this.seguridad.quitarPermisoRol(idRol, permiso.idPermiso).subscribe({
      next: () => {
        this.permisosAsignados = this.permisosAsignados.filter(item => item.idPermiso !== permiso.idPermiso);
        this.idsPermisosSeleccionados.delete(permiso.idPermiso);
        this.notifyService.show('Permiso retirado. Vuelve a iniciar sesión para actualizar los claims.', 'success', 5000);
        this.cdr.detectChanges();
      },
      error: error => this.notifyService.show(extraerMensajeError(error, 'No se pudo retirar el permiso.'), 'error')
    });
  }

}
