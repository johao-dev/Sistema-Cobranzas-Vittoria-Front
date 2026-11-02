import { CommonModule } from '@angular/common';
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
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { PartidaCatalogo } from '../partidas/contratos-partidas';
import { DetallePresupuesto } from '../contratos-presupuestos';
import { normalizarBusqueda } from '../presentacion-presupuestos';

type FilaMonto = FormGroup<{
  idCatalogoPartida: FormControl<number>;
  codigo: FormControl<string>;
  nombre: FormControl<string>;
  grupo: FormControl<string>;
  monto: FormControl<number | null>;
  observacion: FormControl<string>;
}>;

@Component({
  selector: 'carga-montos-presupuesto',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DialogoModal],
  templateUrl: './carga-montos-presupuesto.html',
  styleUrls: ['../dialogos-presupuesto.css', './carga-montos-presupuesto.css'],
})
export class CargaMontosPresupuesto implements OnInit {
  private readonly registro = inject(RegistroPresupuestos);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationService);
  readonly idPresupuesto = input.required<number>();
  readonly idVersion = input.required<number>();
  readonly numeroVersion = input.required<number>();
  readonly simbolo = input('');
  readonly partidas = input.required<PartidaCatalogo[]>();
  readonly detalles = input.required<DetallePresupuesto[]>();
  readonly cerrar = output<void>();
  readonly guardado = output<void>();
  protected readonly guardando = signal(false);
  protected readonly busqueda = signal('');
  protected readonly filas = new FormArray<FilaMonto>([]);
  private readonly valores = toSignal(this.filas.valueChanges, { initialValue: this.filas.value });
  protected readonly visibles = computed(() => {
    this.valores();
    const termino = normalizarBusqueda(this.busqueda());
    return this.filas.controls.filter((f) => {
      const v = f.getRawValue();
      return normalizarBusqueda(`${v.codigo} ${v.nombre} ${v.grupo}`).includes(termino);
    });
  });
  protected readonly total = computed(() =>
    this.valores().reduce((suma, f) => suma + (Number(f.monto) || 0), 0),
  );
  protected readonly conMonto = computed(
    () => this.valores().filter((f) => Number(f.monto) > 0).length,
  );

  ngOnInit(): void {
    const actuales = new Map(this.detalles().map((d) => [d.idCatalogoPartida, d]));
    for (const partida of this.partidas()
      .filter((p) => p.activo && p.esHoja)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))) {
      const detalle = actuales.get(partida.idCatalogoPartida);
      this.filas.push(
        new FormGroup({
          idCatalogoPartida: new FormControl(partida.idCatalogoPartida, { nonNullable: true }),
          codigo: new FormControl(partida.codigo, { nonNullable: true }),
          nombre: new FormControl(partida.nombre, { nonNullable: true }),
          grupo: new FormControl(
            partida.codigoPartidaPadre
              ? `${partida.codigoPartidaPadre} — ${partida.nombrePartidaPadre}`
              : 'Sin partida padre',
            { nonNullable: true },
          ),
          monto: new FormControl<number | null>(detalle?.montoPresupuestado ?? 0, [
            Validators.required,
            Validators.min(0),
          ]),
          observacion: new FormControl(detalle?.observacion ?? '', {
            nonNullable: true,
            validators: Validators.maxLength(500),
          }),
        }),
      );
    }
  }

  protected iniciaGrupo(index: number): boolean {
    const filas = this.visibles();
    return (
      index === 0 || filas[index].controls.grupo.value !== filas[index - 1].controls.grupo.value
    );
  }

  protected guardar(): void {
    if (this.guardando()) return;
    const invalida = this.filas.controls.find(
      (f) => f.invalid || !Number.isFinite(f.controls.monto.value),
    );
    if (invalida) {
      this.notifications.show(
        `Revisa el monto y la observación de la partida ${invalida.controls.codigo.value}: el monto debe ser 0 o mayor y la observación de hasta 500 caracteres.`,
        'info',
      );
      return;
    }
    if (!this.filas.length) return;
    const lote = this.filas.getRawValue().map((f) => ({
      idCatalogoPartida: f.idCatalogoPartida,
      montoPresupuestado: Number(f.monto),
      observacion: f.observacion,
    }));
    this.guardando.set(true);
    this.registro
      .cargarDetallesLote(this.idPresupuesto(), this.idVersion(), lote)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          this.notifications.show(
            `Montos guardados: ${r.agregados} partida(s) agregada(s) y ${r.actualizados} actualizada(s).`,
            'success',
          );
          this.guardado.emit();
        },
        error: (error: unknown) =>
          this.notifications.show(
            extraerMensajeError(error, 'No se pudieron guardar los montos.'),
            'error',
          ),
      });
  }
  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }
}
