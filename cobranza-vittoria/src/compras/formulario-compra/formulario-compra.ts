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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { RegistroCompras } from '../registro-compras';
import { RegistroOrdenesCompra } from '../../ordenes-compra/registro-ordenes-compra';
import { DetalleOrdenCompra } from '../../ordenes-compra/contratos-ordenes-compra';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { EditorImporte } from '../editor-importe/editor-importe';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import {
  PrecioItem,
  prepararItems,
  separarEspecialidades,
  totalesCompra,
  validarItemsCompra,
  peticionCompra,
  fechaLocalCompra,
} from './datos-compra';
@Component({
  selector: 'compra-formulario',
  imports: [CommonModule, FormsModule, DialogoModal, EditorImporte],
  templateUrl: './formulario-compra.html',
  styleUrls: ['../presentacion-compras.css', './formulario-compra.css'],
})
export class FormularioCompra implements OnInit {
  private readonly compras = inject(RegistroCompras);
  private readonly ordenes = inject(RegistroOrdenesCompra);
  private readonly materiales = inject(CatalogoMateriales);
  private readonly destroyRef = inject(DestroyRef);
  readonly idOrden = input.required<number>();
  readonly numero = input.required<string>();
  readonly cerrar = output<void>();
  readonly registrada = output<string>();
  protected readonly detalleOc = signal<DetalleOrdenCompra | null>(null);
  protected readonly items = signal<PrecioItem[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly msg = signal('');
  protected readonly avisoCatalogo = signal('');
  protected readonly especialidad = signal('TODAS');
  protected readonly proveedor = signal('TODOS');
  protected readonly indiceEditor = signal<number | null>(null);
  protected readonly itemEditor = computed(() => {
    const indice = this.indiceEditor();
    return indice === null ? null : this.items()[indice];
  });
  protected readonly fecha = fechaLocalCompra();
  protected readonly totales = computed(() => totalesCompra(this.items()));
  protected readonly especialidades = computed(() => [
    ...new Set(this.items().flatMap((x) => separarEspecialidades(x.especialidad))),
  ]);
  protected readonly proveedores = computed(() => [
    ...new Set(this.items().map((x) => x.proveedor)),
  ]);
  protected readonly filtrados = computed(() =>
    this.items().filter(
      (x) =>
        (this.especialidad() === 'TODAS' ||
          separarEspecialidades(x.especialidad).includes(this.especialidad())) &&
        (this.proveedor() === 'TODOS' || x.proveedor === this.proveedor()),
    ),
  );
  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.msg.set('');
    this.avisoCatalogo.set('');
    forkJoin({
      detalle: this.ordenes.obtener(this.idOrden()),
      materiales: this.materiales.materiales(true).pipe(
        catchError(() => {
          this.avisoCatalogo.set(
            'No se pudo cargar el catálogo de materiales. Se muestran los datos de la O.C.',
          );
          return of([]);
        }),
      ),
    })
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ detalle, materiales }) => {
          this.detalleOc.set(detalle);
          this.items.set(prepararItems(detalle, materiales));
        },
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudo cargar la O.C. pendiente.')),
      });
  }

  protected mostrarEspecialidad(item: PrecioItem): string {
    return this.especialidad() === 'TODAS'
      ? separarEspecialidades(item.especialidad).join(', ')
      : this.especialidad();
  }

  protected editar(item: PrecioItem): void {
    this.indiceEditor.set(this.items().indexOf(item));
  }

  protected guardarItem(item: PrecioItem): void {
    const indice = this.indiceEditor();
    this.items.update((items) => items.map((actual, i) => (i === indice ? item : actual)));
    this.indiceEditor.set(null);
    this.msg.set('Precio cargado correctamente para el ítem.');
  }

  protected solicitarCierre(): void {
    if (!this.guardando() && this.indiceEditor() === null) this.cerrar.emit();
  }

  protected registrar(): void {
    if (this.guardando() || this.cargando() || !this.detalleOc()) return;
    const error = validarItemsCompra(this.items());
    if (error) {
      this.msg.set(error);
      return;
    }
    const dto = peticionCompra(this.idOrden(), this.numero(), this.fecha, this.items());
    const archivos = this.items().flatMap((item) => item.files);
    this.guardando.set(true);
    this.msg.set('');
    this.compras
      .registrarCompra(dto)
      .pipe(
        switchMap((res) => {
          if (!res.idCompra)
            return of('La compra se registró, pero no se obtuvo el identificador.');
          if (!archivos.length)
            return of(
              'Compra registrada correctamente. Puedes subir los archivos después desde el detalle.',
            );
          return this.compras.uploadDocumentosCompra(res.idCompra, archivos).pipe(
            map(() => 'Compra registrada y documentos subidos correctamente.'),
            catchError((error: unknown) =>
              of(
                'La compra se registró, pero falló la subida de documentos. ' +
                  extraerMensajeError(error, 'Puedes reintentarlo desde el detalle.'),
              ),
            ),
          );
        }),
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (mensaje) => this.registrada.emit(mensaje),
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudo registrar la compra.')),
      });
  }
}
