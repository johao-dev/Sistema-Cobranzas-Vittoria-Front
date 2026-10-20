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
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize, startWith } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { normalizarNombreSolicitante } from '../../shared/presentacion/nombre-solicitante';
import { RequerimientoGetResponse } from '../../requerimientos/contratos-requerimientos';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { Proveedor } from '../../catalogos/proveedores/contratos-proveedores';
import { RegistroOrdenesCompra } from '../registro-ordenes-compra';
import { fechaLocalOrden, subtotalOrden } from '../datos-orden';
import { mensajeOrden } from '../mensaje-orden';
import {
  ControlesItemOrden,
  controlesItemOrden,
  peticionOrden,
  validarFormularioOrden,
} from './datos-formulario-orden';
import {
  NuevoProveedorOrden,
  ProveedorOrdenCreado,
} from '../nuevo-proveedor-orden/nuevo-proveedor-orden';

@Component({
  selector: 'formulario-orden',
  imports: [CommonModule, ReactiveFormsModule, DialogoModal, NuevoProveedorOrden],
  templateUrl: './formulario-orden.html',
  styleUrl: '../presentacion-ordenes.css',
})
export class FormularioOrden implements OnInit {
  readonly detalle = input.required<RequerimientoGetResponse>();
  readonly numero = input.required<string>();
  readonly cerrar = output<void>();
  readonly creada = output<void>();

  private readonly registro = inject(RegistroOrdenesCompra);
  private readonly catalogo = inject(CatalogoProveedores);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = new FormArray<ControlesItemOrden>([]);
  private readonly valores = toSignal(this.items.valueChanges.pipe(startWith(this.items.value)));
  protected readonly total = computed(() =>
    (this.valores() ?? []).reduce(
      (suma, item) => suma + subtotalOrden(item.cantidad ?? 0, item.precioUnitario ?? null),
      0,
    ),
  );
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly guardando = signal(false);
  protected readonly cargandoProveedores = signal(false);
  protected readonly errorProveedores = signal('');
  protected readonly mensaje = signal('');
  protected readonly nuevoProveedor = signal(false);
  protected readonly fecha = fechaLocalOrden();
  protected readonly nombreSolicitante = normalizarNombreSolicitante;
  protected readonly subtotal = subtotalOrden;

  ngOnInit(): void {
    for (const item of this.detalle().items) this.items.push(controlesItemOrden(item));

    this.cargarProveedores();
  }

  protected cargarProveedores(): void {
    if (this.cargandoProveedores()) return;

    this.cargandoProveedores.set(true);
    this.errorProveedores.set('');

    this.catalogo
      .proveedores(true)
      .pipe(
        finalize(() => this.cargandoProveedores.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (proveedores) => this.proveedores.set(proveedores),
        error: (error) =>
          this.errorProveedores.set(mensajeOrden(error, 'No se pudieron cargar los proveedores.')),
      });
  }

  protected proveedorCreado(resultado: ProveedorOrdenCreado): void {
    this.proveedores.set(resultado.proveedores);

    for (const item of this.items.controls) {
      if (!item.controls.idProveedor.value)
        item.controls.idProveedor.setValue(resultado.idProveedor);
    }

    this.nuevoProveedor.set(false);
    this.mensaje.set('Proveedor creado correctamente.');
  }

  protected solicitarCierre(): void {
    if (this.guardando() || this.nuevoProveedor()) return;

    this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando() || this.nuevoProveedor()) return;

    const items = this.items.getRawValue();
    const error = validarFormularioOrden(this.detalle(), items);

    if (error) {
      this.mensaje.set(error);
      this.items.markAllAsTouched();
      return;
    }

    const dto = peticionOrden(this.detalle(), this.numero(), this.fecha, items);

    this.guardando.set(true);
    this.items.disable();
    this.mensaje.set('');

    this.registro
      .crear(dto)
      .pipe(
        finalize(() => {
          this.guardando.set(false);
          this.items.enable();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.creada.emit(),
        error: (error) => this.mensaje.set(mensajeOrden(error, 'No se pudo guardar la orden.')),
      });
  }
}
