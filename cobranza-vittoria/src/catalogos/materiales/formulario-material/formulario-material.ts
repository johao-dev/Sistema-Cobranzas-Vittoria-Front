import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';
import { Material, MaterialUpsert, OpcionPartida } from '../contratos-materiales';
import { CatalogoMateriales } from '../catalogo-materiales';
import { Especialidad } from '../../especialidades/contratos-especialidades';
import { UnidadMedida } from '../../unidades-medida/contratos-unidades-medida';
import { completarPartidas } from '../opciones-partida';
import { mensajeCatalogo } from '../../mensaje-catalogo';

@Component({
  selector: 'formulario-material',
  imports: [ReactiveFormsModule],
  templateUrl: './formulario-material.html',
  styleUrl: './formulario-material.css',
})
export class FormularioMaterial {
  readonly valor = input<Material | null>(null);
  readonly especialidades = input<readonly Especialidad[]>([]);
  readonly unidades = input<readonly UnidadMedida[]>([]);
  readonly partidas = input<readonly OpcionPartida[]>([]);
  readonly guardando = input(false);
  readonly bloqueado = input(false);
  readonly guardar = output<MaterialUpsert>();
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly api: CatalogoMateriales = inject(CatalogoMateriales);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private codigoSub?: Subscription;
  private idMaterial: number | null = null;
  protected readonly codigo = signal('');
  protected readonly cargandoCodigo = signal(false);
  protected readonly error = signal('');
  protected readonly opcionesPartida = computed(() =>
    completarPartidas(this.partidas(), this.valor()),
  );
  protected readonly form = this.fb.group({
    idEspecialidad: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    codigoProveedor: this.fb.nonNullable.control(''),
    descripcion: this.fb.nonNullable.control('', Validators.required),
    unidadMedida: this.fb.nonNullable.control('', Validators.required),
    idCatalogoPartida: this.fb.control<number | null>(null),
    stockMinimo: this.fb.control<number | null>(0, Validators.min(0)),
    activo: this.fb.nonNullable.control(true),
  });

  constructor() {
    effect(() => {
      const valor: Material | null = this.valor();
      this.codigoSub?.unsubscribe();
      this.idMaterial = valor?.idMaterial ?? null;
      this.form.reset({
        idEspecialidad: valor?.idEspecialidad ?? null,
        codigoProveedor: valor?.codigoProveedor ?? '',
        descripcion: valor?.descripcion ?? '',
        unidadMedida: valor?.unidadMedida ?? '',
        idCatalogoPartida: valor?.idCatalogoPartida ?? null,
        stockMinimo: valor?.stockMinimo ?? 0,
        activo: valor?.activo ?? true,
      });
      this.error.set('');
      this.codigo.set(valor?.codigo ?? '');
      if (!valor) this.cargarCodigo();
    });
  }

  private cargarCodigo(): void {
    this.codigoSub?.unsubscribe();
    this.cargandoCodigo.set(true);
    this.codigo.set('');
    this.codigoSub = this.api
      .siguienteCodigo()
      .pipe(
        finalize(() => this.cargandoCodigo.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (datos) => this.codigo.set(datos.codigo),
        error: (error: unknown) =>
          this.error.set(
            mensajeCatalogo(error, 'No se pudo obtener el código. Se asignará al guardar.'),
          ),
      });
  }

  protected limpiar(): void {
    this.idMaterial = null;
    this.form.reset();
    this.error.set('');
    this.cargarCodigo();
  }

  protected enviar(): void {
    if (this.guardando() || this.bloqueado()) return;
    this.form.markAllAsTouched();
    const datos = this.form.getRawValue();
    if (
      this.form.invalid ||
      !datos.idEspecialidad ||
      !datos.descripcion.trim() ||
      !datos.unidadMedida.trim()
    ) {
      this.error.set(
        'Selecciona especialidad y unidad, e ingresa descripción y stock mínimo válido.',
      );
      return;
    }
    this.guardar.emit({
      ...datos,
      idMaterial: this.idMaterial,
      idEspecialidad: datos.idEspecialidad,
      codigo: this.idMaterial ? this.codigo() : '',
      descripcion: datos.descripcion.trim(),
      unidadMedida: datos.unidadMedida.trim(),
      stockMinimo: datos.stockMinimo ?? 0,
    });
  }
}
