import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { Permiso } from '../contratos-permisos';
import { RegistroPermisos } from '../registro-permisos';

@Component({
  selector: 'formulario-permiso',
  imports: [FormsModule, DialogoModal],
  templateUrl: './formulario-permiso.html',
  styleUrls: ['../../dialogos-accesos.css'],
})
export class FormularioPermiso implements OnInit {
  private readonly registro = inject(RegistroPermisos);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  readonly valor = input.required<Permiso>();
  readonly guardado = output<void>();
  readonly cerrar = output<void>();
  protected readonly guardando = signal(false);
  protected readonly msg = signal('');
  protected form = { nombre: '', descripcion: '' };

  ngOnInit(): void {
    const permiso = this.valor();
    this.form = { nombre: permiso.nombre, descripcion: permiso.descripcion };
  }

  protected guardar(): void {
    if (this.guardando()) return;
    const nombre = this.form.nombre.trim();
    const descripcion = this.form.descripcion.trim();
    if (!nombre || nombre.length > 100 || descripcion.length > 255) {
      const mensaje = !nombre
        ? 'Debes ingresar el nombre de la acción.'
        : 'El nombre admite hasta 100 caracteres y la descripción hasta 255.';
      this.msg.set(mensaje);
      this.notificaciones.show(mensaje, 'error');
      return;
    }
    this.guardando.set(true);
    this.msg.set('');
    this.registro
      .actualizarPermiso(this.valor().idPermiso, { nombre, descripcion })
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Acción actualizada correctamente.', 'success');
          this.guardado.emit();
        },
        error: (error: unknown) => {
          const mensaje = extraerMensajeError(error, 'No se pudo actualizar la acción.');
          this.msg.set(mensaje);
          this.notificaciones.show(mensaje, 'error');
        },
      });
  }

  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }
}
