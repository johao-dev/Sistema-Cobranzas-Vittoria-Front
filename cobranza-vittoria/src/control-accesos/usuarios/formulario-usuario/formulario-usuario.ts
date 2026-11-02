import {
  Component,
  DestroyRef,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { extraerMensajeError } from '../../../app/core/utils/api-error.util';
import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';
import { RegistroUsuarios } from '../registro-usuarios';
import { RolUsuario } from '../contratos-usuarios';
import {
  datosAltaUsuario,
  datosEdicionUsuario,
  validarCorreoUsuario,
} from './datos-formulario-usuario';
import { AsignacionRolesUsuario } from '../asignacion-roles-usuario/asignacion-roles-usuario';

@Component({
  selector: 'formulario-usuario',
  imports: [ReactiveFormsModule, DialogoModal, AsignacionRolesUsuario],
  templateUrl: './formulario-usuario.html',
  styleUrls: ['../../dialogos-accesos.css', './formulario-usuario.css'],
})
export class FormularioUsuario implements OnChanges {
  private readonly registro = inject(RegistroUsuarios);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(NotificationService);
  private consultaDetalle?: Subscription;
  readonly idUsuario = input<number | null>(null);
  readonly guardado = output<void>();
  readonly cerrar = output<void>();
  readonly solicitarAlta = output<void>();
  protected readonly cargando = signal(false);
  protected readonly listo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly asignando = signal(false);
  protected readonly errorDetalle = signal('');
  protected readonly msg = signal('');
  protected readonly rolesAsignados = signal<RolUsuario[]>([]);
  protected readonly form = new FormGroup({
    nombres: new FormControl('', { nonNullable: true, validators: Validators.required }),
    apellidos: new FormControl('', { nonNullable: true }),
    correo: new FormControl('', { nonNullable: true }),
    usuarioLogin: new FormControl('', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', { nonNullable: true }),
    activo: new FormControl(true, { nonNullable: true }),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idUsuario']) this.iniciarFormulario();
  }

  private iniciarFormulario(): void {
    this.consultaDetalle?.unsubscribe();
    this.msg.set('');
    this.errorDetalle.set('');
    this.rolesAsignados.set([]);
    this.form.reset();
    const esAlta = this.idUsuario() === null;
    this.form.controls.apellidos.setValidators(esAlta ? [Validators.required] : []);
    this.form.controls.correo.setValidators(
      esAlta ? [Validators.required, validarCorreoUsuario] : [validarCorreoUsuario],
    );
    this.form.controls.password.setValidators(esAlta ? [Validators.required] : []);
    for (const control of Object.values(this.form.controls)) control.updateValueAndValidity();
    this.listo.set(esAlta);
    if (!esAlta) this.cargarDetalle();
  }

  protected cargarDetalle(): void {
    const id = this.idUsuario();
    if (id === null) return;
    this.consultaDetalle?.unsubscribe();
    this.cargando.set(true);
    this.listo.set(false);
    this.errorDetalle.set('');
    this.consultaDetalle = this.registro
      .usuario(id)
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle) => {
          this.form.reset({
            nombres: detalle.usuario.nombres,
            apellidos: detalle.usuario.apellidos,
            correo: detalle.usuario.correo,
            usuarioLogin: detalle.usuario.usuarioLogin,
            password: '',
            activo: detalle.usuario.activo,
          });
          this.rolesAsignados.set(detalle.roles);
          this.listo.set(true);
        },
        error: (error: unknown) =>
          this.errorDetalle.set(extraerMensajeError(error, 'No se pudo cargar el usuario.')),
      });
  }

  protected limpiar(): void {
    if (this.guardando() || this.asignando()) return;
    // Limpiar conserva la acción histórica de volver al alta y vaciar los datos del editor.
    if (this.idUsuario() === null) this.iniciarFormulario();
    else this.solicitarAlta.emit();
  }

  protected guardar(): void {
    if (!this.listo() || this.cargando() || this.guardando() || this.asignando()) return;

    const valores = this.form.getRawValue();
    if (
      this.form.invalid ||
      !valores.nombres.trim() ||
      !valores.usuarioLogin.trim() ||
      (this.idUsuario() === null && (!valores.apellidos.trim() || !valores.correo.trim()))
    ) {
      this.form.markAllAsTouched();
      this.msg.set('Completa los datos requeridos y verifica el formato del correo.');
      return;
    }

    const id = this.idUsuario();
    const peticion: Observable<unknown> =
      id === null
        ? this.registro.crearUsuario(datosAltaUsuario(valores))
        : this.registro.actualizarUsuario(id, datosEdicionUsuario(valores));

    this.guardando.set(true);
    this.msg.set('');

    peticion
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Usuario guardado correctamente.', 'success');
          this.guardado.emit();
        },
        error: (error: unknown) => {
          const mensaje = extraerMensajeError(error, 'No se pudo guardar el usuario.');
          this.msg.set(mensaje);
          this.notificaciones.show(mensaje, 'error');
        },
      });
  }

  protected cerrarFormulario(): void {
    if (!this.guardando() && !this.asignando()) this.cerrar.emit();
  }
}
