import { MaterialSeleccionado } from '../contratos-formulario-requerimiento';
import { Component, DestroyRef, effect, inject, input, model, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, of, switchMap, tap } from 'rxjs';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { UnidadMedida } from '../../catalogos/unidades-medida/contratos-unidades-medida';
import { MaterialUpsert } from '../../catalogos/materiales/contratos-materiales';
import { PartidaCatalogo } from '../../app/models/consultas-presupuestarias.models';
import { NotificationService } from '../../app/core/services/notification.service';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import { DialogoRequerimiento } from '../dialogo-requerimiento/dialogo-requerimiento';

@Component({
  selector: 'nuevo-material',
  imports: [ReactiveFormsModule, DialogoRequerimiento],
  templateUrl: './nuevo-material.html',
  styleUrls: ['../presentacion-requerimientos.css', './nuevo-material.css'],
})
export class NuevoMaterial {
  readonly especialidades = input.required<Especialidad[]>();
  readonly unidades = input.required<UnidadMedida[]>();
  readonly partidas = input.required<PartidaCatalogo[]>();
  readonly avisoPartidas = input('');
  readonly especialidadInicial = input<number | null>(null);
  readonly partidaInicial = input<number | null>(null);
  readonly guardando = model(false);
  readonly guardado = output<MaterialSeleccionado>();
  readonly cerrar = output<void>();

  private readonly materialesApi = inject(CatalogoMateriales);
  private readonly notificaciones = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mensaje = signal('');
  protected readonly creado = signal<{
    idMaterial: number;
    idEspecialidad: number;
  } | null>(null);

  protected readonly formulario = new FormGroup({
    idEspecialidad: new FormControl<number | null>(null, Validators.required),
    unidadMedida: new FormControl('', { nonNullable: true, validators: Validators.required }),
    descripcion: new FormControl('', { nonNullable: true, validators: Validators.required }),
    codigoProveedor: new FormControl('', { nonNullable: true }),
    idCatalogoPartida: new FormControl<number | null>(null),
  });

  constructor() {
    effect(() => {
      this.formulario.patchValue(
        { idEspecialidad: this.especialidadInicial(), idCatalogoPartida: this.partidaInicial() },
        { emitEvent: false },
      );
    });

    effect(() => {
      if (this.guardando() || this.creado()) this.formulario.disable({ emitEvent: false });
      else this.formulario.enable({ emitEvent: false });
    });
  }

  protected cancelar(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando()) return;

    const valores = this.formulario.getRawValue();
    const pendiente = this.creado();

    if (
      !pendiente &&
      (!valores.idEspecialidad || !valores.descripcion.trim() || !valores.unidadMedida)
    ) {
      this.formulario.markAllAsTouched();
      this.mensaje.set('Debes seleccionar especialidad, unidad de medida e ingresar el material.');
      return;
    }

    const dto: MaterialUpsert = {
      idMaterial: null,
      idEspecialidad: valores.idEspecialidad ?? 0,
      codigo: '',
      codigoProveedor: valores.codigoProveedor.trim(),
      descripcion: valores.descripcion.trim(),
      unidadMedida: valores.unidadMedida,
      stockMinimo: 0,
      activo: true,
      idCatalogoPartida: valores.idCatalogoPartida,
    };

    // Tras un POST exitoso se reintenta solamente la lectura si falló el catálogo.
    const alta = pendiente
      ? of(pendiente)
      : this.materialesApi.guardarMaterial(dto).pipe(
          tap((respuesta) => {
            this.creado.set({ ...respuesta, idEspecialidad: dto.idEspecialidad });

            this.notificaciones.show('Material agregado correctamente.', 'success');
          }),
        );

    this.guardando.set(true);
    this.mensaje.set('');

    alta
      .pipe(
        switchMap((respuesta) =>
          this.materialesApi.materiales(true).pipe(
            tap((materiales) => {
              this.guardado.emit({
                materiales,
                idMaterial: respuesta.idMaterial,
                idEspecialidad: dto.idEspecialidad,
              });
            }),
          ),
        ),
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);

          this.cerrar.emit();
        },
        error: (error: unknown) =>
          this.mensaje.set(
            mensajeRequerimiento(
              error,
              this.creado()
                ? 'El material se creó. Reintenta actualizar el catálogo para seleccionarlo.'
                : 'No se pudo agregar el material.',
            ),
          ),
      });
  }
}
