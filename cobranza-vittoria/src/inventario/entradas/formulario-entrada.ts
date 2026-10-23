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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { RegistroInventario } from '../registro-inventario';
import { KardexEntradaResponseDto } from '../contratos-inventario';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { Proveedor } from '../../catalogos/proveedores/contratos-proveedores';
import { mensajeErrorInventario } from '../errores-inventario';
import { BorradorEntrada, borradorEntrada, peticionEntrada } from './datos-entrada';

@Component({
  selector: 'inventario-formulario-entrada',
  imports: [FormsModule, DialogoModal],
  templateUrl: './formulario-entrada.html',
  styleUrl: '../presentacion-inventario/presentacion-inventario.css',
})
export class FormularioEntrada implements OnInit {
  private readonly registro = inject(RegistroInventario);
  private readonly destroyRef = inject(DestroyRef);

  readonly entrada = input<KardexEntradaResponseDto | null>(null);
  readonly especialidades = input.required<readonly Especialidad[]>();
  readonly materiales = input.required<readonly Material[]>();
  readonly proveedores = input.required<readonly Proveedor[]>();
  readonly proyectos = input.required<readonly Proyecto[]>();

  readonly cerrar = output<void>();
  readonly guardada = output<string>();

  protected readonly form = signal<BorradorEntrada>(borradorEntrada(null));

  protected readonly guardando = signal(false);
  protected readonly msg = signal('');

  protected readonly materialesFiltrados = computed(() =>
    this.materiales().filter((m) => m.idEspecialidad === this.form().idEspecialidad),
  );
  protected readonly cantidadInvalida = computed(
    () => !Number.isFinite(this.form().cantidad ?? 0) || (this.form().cantidad ?? 0) < 0,
  );

  ngOnInit(): void {
    this.form.set(borradorEntrada(this.entrada()));
  }

  protected actualizar<K extends keyof BorradorEntrada>(campo: K, valor: BorradorEntrada[K]): void {
    this.form.update((form) => ({ ...form, [campo]: valor }));
  }

  protected cambiarEspecialidad(idEspecialidad: number | null): void {
    this.form.update((form) => ({ ...form, idEspecialidad, idMaterial: null }));
  }

  protected reset(): void {
    if (!this.guardando()) {
      this.form.set(borradorEntrada(null));
      this.msg.set('');
    }
  }

  protected solicitarCierre(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando()) return;

    const dto = peticionEntrada(this.form());
    if (typeof dto === 'string') {
      this.msg.set(dto);
      return;
    }

    const id = dto.idKardexEntrada;
    const operacion = id
      ? this.registro.actualizarEntrada(id, dto)
      : this.registro.crearEntrada(dto);

    this.guardando.set(true);
    this.msg.set('');

    operacion
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          this.guardada.emit(
            id ? 'Entrada actualizada correctamente.' : 'Entrada registrada correctamente.',
          ),
        error: (error: unknown) =>
          this.msg.set(mensajeErrorInventario(error, 'No se pudo guardar la entrada.')),
      });
  }
}
