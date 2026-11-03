import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, map, of, switchMap } from 'rxjs';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import {
  GastoDirectoListado,
  GastoDirectoRequest,
  PartidaDisponibleGastoDirecto,
} from '../contratos-gastos-directos';
import { RegistroGastosDirectos } from '../registro-gastos-directos';
import { ReferenciasGastos } from '../referencias-gastos';
import { validarFormularioGasto, construirPeticionGasto } from './datos-formulario-gasto';

@Component({
  selector: 'formulario-gasto',
  imports: [CommonModule, ReactiveFormsModule, DialogoModal],
  templateUrl: './formulario-gasto.html',
  styleUrl: '../gastos-directos.css',
})
export class FormularioGasto implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registro = inject(RegistroGastosDirectos);
  private readonly notifications = inject(Notificaciones);
  private readonly sesion = inject(SesionUsuario);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly referencias = inject(ReferenciasGastos);

  readonly valor = input<GastoDirectoListado | null>(null);

  readonly cancelar = output<void>();
  readonly guardado = output<void>();

  protected readonly form = this.fb.group({
    idCategoriaGasto: this.fb.nonNullable.control<number | ''>(''),
    idCentroCosto: this.fb.nonNullable.control<number | ''>(''),
    idPresupuestoDetalle: this.fb.nonNullable.control<number | ''>({ value: '', disabled: true }),
    idProveedor: this.fb.nonNullable.control<number | ''>(''),
    idMoneda: this.fb.nonNullable.control<number | ''>(''),
    fecha: this.fb.nonNullable.control(new Date().toISOString().substring(0, 10)),
    concepto: this.fb.nonNullable.control(''),
    descripcion: this.fb.nonNullable.control(''),
    monto: this.fb.control<number | null>({ value: null, disabled: true }),
    facturaOtraMoneda: this.fb.nonNullable.control({ value: false, disabled: true }),
    idMonedaOriginal: this.fb.nonNullable.control<number | ''>(''),
    montoOriginal: this.fb.control<number | null>(null),
    tipoCambio: this.fb.control<number | null>(null),
    fechaTipoCambio: this.fb.nonNullable.control(''),
  });

  private readonly datos = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  private readonly centrosSolicitados = new Subject<number | ''>();
  protected readonly partidas = signal<PartidaDisponibleGastoDirecto[]>([]);
  protected readonly cargandoPartidas = signal(false);
  protected readonly errorPartidas = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected readonly categoriaNoDisponible = computed(() => {
    const gasto = this.valor();
    return (
      gasto !== null &&
      !this.referencias
        .categorias()
        .some((categoria) => categoria.idCategoriaGasto === gasto.idCategoriaGasto)
    );
  });

  protected readonly partidaSeleccionada = computed(
    () =>
      this.partidas().find(
        (partida) => partida.idPresupuestoDetalle === this.datos().idPresupuestoDetalle,
      ) ?? null,
  );
  protected readonly monedaPresupuesto = computed(() => {
    const partida = this.partidaSeleccionada();

    if (!partida) return null;
    return (
      this.referencias.monedas().find((moneda) => moneda.idMoneda === partida.idMoneda) ?? {
        idMoneda: partida.idMoneda,
        codigo: partida.codigoMoneda,
        simbolo: partida.simboloMoneda,
      }
    );
  });
  protected readonly monedasOriginales = computed(() =>
    this.referencias.monedas().filter((moneda) => moneda.idMoneda !== this.datos().idMoneda),
  );
  protected readonly excedeSaldo = computed(
    () => (this.datos().monto ?? 0) > (this.partidaSeleccionada()?.saldoDisponible ?? Infinity),
  );
  protected readonly montoSugerido = computed(() => {
    const datos = this.datos();
    return datos.facturaOtraMoneda && (datos.montoOriginal ?? 0) > 0 && (datos.tipoCambio ?? 0) > 0
      ? Math.round(Number(datos.montoOriginal) * Number(datos.tipoCambio) * 100) / 100
      : null;
  });

  constructor() {
    this.centrosSolicitados
      .pipe(
        switchMap((id) => {
          this.partidas.set([]);
          this.form.controls.idPresupuestoDetalle.disable({ emitEvent: false });
          this.onPartidaChange();
          this.errorPartidas.set('');
          this.cargandoPartidas.set(!!id);
          if (!id) return of([]);
          return this.registro.partidasDisponibles(id).pipe(
            catchError((error: unknown) => {
              this.errorPartidas.set(
                extraerMensajeError(error, 'No se pudieron cargar las partidas.'),
              );
              return of([]);
            }),
            finalize(() => this.cargandoPartidas.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((partidas) => {
        this.partidas.set(partidas);
        if (partidas.length) this.form.controls.idPresupuestoDetalle.enable({ emitEvent: false });
        this.onPartidaChange();
      });
  }

  ngOnInit(): void {
    const row = this.valor();
    if (row) {
      this.form.patchValue({
        ...row,
        idCategoriaGasto: row.idCategoriaGasto ?? '',
        idProveedor: row.idProveedor ?? '',
        descripcion: row.descripcion ?? '',
        fecha: row.fecha.substring(0, 10),
        facturaOtraMoneda: row.idMonedaOriginal !== null,
        idMonedaOriginal: row.idMonedaOriginal ?? '',
        montoOriginal: row.montoOriginal,
        tipoCambio: row.tipoCambio,
        fechaTipoCambio: row.fechaTipoCambio?.substring(0, 10) ?? '',
      });
      this.cargarPartidas();
    } else {
      const categoriaAdministrativa = this.referencias
        .categorias()
        .find((categoria) => categoria.codigo.trim().toUpperCase() === 'ADMINISTRATIVO');

      this.form.controls.idCategoriaGasto.setValue(categoriaAdministrativa?.idCategoriaGasto ?? '');
    }
  }

  protected onCentroCostoFormChange(): void {
    this.form.patchValue({ idPresupuestoDetalle: '', idMoneda: '' });
    this.cargarPartidas();
  }

  protected cargarPartidas(): void {
    this.centrosSolicitados.next(this.form.controls.idCentroCosto.value);
  }

  protected onPartidaChange(): void {
    const partida = this.partidas().find(
      (item) => item.idPresupuestoDetalle === this.form.controls.idPresupuestoDetalle.value,
    );
    for (const control of [this.form.controls.monto, this.form.controls.facturaOtraMoneda]) {
      if (partida) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    const idMoneda = partida?.idMoneda ?? '';
    this.form.controls.idMoneda.setValue(idMoneda);
    if (this.form.controls.idMonedaOriginal.value === idMoneda)
      this.form.controls.idMonedaOriginal.setValue('');
  }

  protected onFacturaOtraMonedaChange(): void {
    if (this.form.controls.facturaOtraMoneda.value && !this.form.controls.fechaTipoCambio.value)
      this.form.controls.fechaTipoCambio.setValue(this.form.controls.fecha.value);
  }

  protected usarMontoSugerido(): void {
    const monto = this.montoSugerido();

    if (monto !== null) this.form.controls.monto.setValue(monto);
  }

  protected guardar(): void {
    if (this.guardando() || !this.sesion.hasPermission('gasto_directo.operar')) return;

    const datos = this.form.getRawValue();
    const error = validarFormularioGasto(
      datos,
      this.referencias.categorias(),
      this.partidaSeleccionada(),
    );
    this.error.set(error);
    if (error) return;

    const dto: GastoDirectoRequest = construirPeticionGasto(datos);
    const id = this.valor()?.idGastoDirecto;
    this.guardando.set(true);
    (id ? this.registro.actualizar(id, dto) : this.registro.crear(dto))
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show(
            'Gasto guardado. No afecta el saldo hasta que se confirme.',
            'success',
          );
          this.guardado.emit();
        },
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo guardar el gasto.')),
      });
  }

  protected cerrar(): void {
    if (!this.guardando()) this.cancelar.emit();
  }
}
