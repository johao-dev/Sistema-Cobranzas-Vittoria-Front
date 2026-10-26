import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, Subscription, tap } from 'rxjs';

import { PermisoCardComponent } from '../../shared/components/permiso-card/permiso-card.component';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';
import { esCodigoError, extraerMensajeError } from '../../core/utils/api-error.util';
import { Permiso } from '../../models/permisos.models';
import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';

@Component({
  standalone: true,
  selector: 'app-permisos-page',
  imports: [CommonModule, FormsModule, PermisoCardComponent, DialogoModal],
  templateUrl: './permisos.page.html',
  styleUrl: './permisos.page.css',
})
export class PermisosPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private consultaListado?: Subscription;

  permisosListado: Permiso[] = [];
  cargando = false;
  filtroBusqueda = '';
  filtroActivo = true;
  errorListado = '';
  msg = '';
  modalOpen = false;
  guardando = false;
  cambiandoEstado: number | null = null;
  idPermisoEdicion: number | null = null;
  form = { nombre: '', descripcion: '' };

  constructor(
    private seguridad: SeguridadService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.consultaListado?.unsubscribe();
    this.cargando = true;
    this.errorListado = '';

    this.consultaListado = this.seguridad
      .permisos(this.filtroActivo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.permisosListado = res.permisos;
        },
        error: (error: unknown) => {
          this.permisosListado = [];
          this.errorListado = extraerMensajeError(error, 'No se pudieron cargar las acciones.');
          this.notifyService.show(this.errorListado, 'error');
        },
      });
  }

  private normalizarBusqueda(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  get rowsFiltradas(): Permiso[] {
    const termino = this.normalizarBusqueda(this.filtroBusqueda);
    if (!termino) return this.permisosListado;

    return this.permisosListado.filter((row) =>
      this.normalizarBusqueda(`${row.nombre} ${row.descripcion}`).includes(termino),
    );
  }

  cerrarModal(): void {
    if (this.guardando) return;

    this.modalOpen = false;
    this.idPermisoEdicion = null;
    this.msg = '';
    this.cdr.markForCheck();
  }

  edit(row: Permiso): void {
    if (this.cargando || this.guardando || this.cambiandoEstado !== null) return;

    this.idPermisoEdicion = row.idPermiso;
    this.form = { nombre: row.nombre, descripcion: row.descripcion };
    this.msg = '';
    this.modalOpen = true;
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.idPermisoEdicion === null || this.idPermisoEdicion <= 0 || this.guardando) return;

    const nombre = this.form.nombre.trim();
    const descripcion = this.form.descripcion.trim();
    if (!nombre || nombre.length > 100 || descripcion.length > 255) {
      this.msg = !nombre
        ? 'Debes ingresar el nombre de la acción.'
        : 'El nombre admite hasta 100 caracteres y la descripción hasta 255.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    this.guardando = true;
    this.msg = '';
    this.seguridad
      .actualizarPermiso(this.idPermisoEdicion, { nombre, descripcion })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.notifyService.show('Acción actualizada correctamente.', 'success');
          this.modalOpen = false;
          this.idPermisoEdicion = null;
          this.load();
        },
        error: (error: unknown) => {
          this.msg = extraerMensajeError(error, 'No se pudo actualizar la acción.');
          this.notifyService.show(this.msg, 'error');
        },
      });
  }

  onToggle(row: Permiso, activo: boolean): void {
    if (
      this.cargando ||
      this.guardando ||
      this.modalOpen ||
      this.cambiandoEstado !== null ||
      row.idPermiso <= 0 ||
      row.activo === activo
    )
      return;

    const accion = activo ? 'habilitar' : 'deshabilitar';
    if (!confirm(`¿Deseas ${accion} la acción «${row.nombre}» para todo el sistema?`)) return;

    this.cambiandoEstado = row.idPermiso;
    const peticion = activo
      ? this.seguridad.habilitarPermiso(row.idPermiso)
      : this.seguridad.deshabilitarPermiso(row.idPermiso);

    peticion
      .pipe(
        tap(() => {
          this.notifyService.show(
            activo ? 'Acción habilitada.' : 'Acción deshabilitada.',
            'success',
          );
          this.load();
        }),
        catchError((error: unknown) => {
          this.notifyService.show(
            extraerMensajeError(error, 'No se pudo cambiar el estado.'),
            'error',
          );
          const estadoRepetido =
            esCodigoError(error, 'PERMISO_YA_HABILITADO') ||
            esCodigoError(error, 'PERMISO_YA_DESHABILITADO');
          if (!estadoRepetido) return EMPTY;

          // Otra sesión pudo cambiar el estado. Consultar el servidor sin repetir el PATCH.
          return this.seguridad.permisoPorId(row.idPermiso).pipe(
            tap((permiso) => {
              this.permisosListado = this.permisosListado
                .map((actual) => (actual.idPermiso === permiso.idPermiso ? permiso : actual))
                .filter((actual) => actual.activo === this.filtroActivo);
            }),
            catchError((errorConsulta: unknown) => {
              this.notifyService.show(
                extraerMensajeError(errorConsulta, 'No se pudo sincronizar la acción.'),
                'error',
              );
              this.load();
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cambiandoEstado = null;
          this.cdr.markForCheck();
        }),
      )
      .subscribe();
  }
}
