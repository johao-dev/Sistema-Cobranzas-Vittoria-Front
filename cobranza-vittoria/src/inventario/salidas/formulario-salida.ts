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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { finalize, map } from 'rxjs';

import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { RegistroInventario } from '../registro-inventario';
import { KardexSalidaResponseDto } from '../contratos-inventario';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { cantidadInventario } from '../presentacion-inventario/datos-presentacion-inventario';
import {
  ItemBorradorSalida,
  controlesSalida,
  controlesItemSalida,
  itemDesdeSalida,
  peticionSalida,
} from './datos-salida';
import { EditorItemSalida } from './editor-item-salida';

@Component({
  selector: 'inventario-formulario-salida',
  imports: [ReactiveFormsModule, DialogoModal, EditorItemSalida],
  templateUrl: './formulario-salida.html',
  styleUrl: '../presentacion-inventario/presentacion-inventario.css',
})
export class FormularioSalida implements OnInit {
  private readonly registro = inject(RegistroInventario);
  private readonly destroyRef = inject(DestroyRef);

  readonly filas = input.required<readonly KardexSalidaResponseDto[]>();
  readonly materiales = input.required<readonly Material[]>();
  readonly especialidades = input.required<readonly Especialidad[]>();
  readonly proyectos = input.required<readonly Proyecto[]>();

  readonly cerrar = output<void>();
  readonly guardada = output<string>();

  protected readonly form = controlesSalida();

  protected readonly valores = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly guardando = signal(false);
  protected readonly msg = signal('');
  protected readonly editor = signal<{
    indice: number | null;
    item: ItemBorradorSalida | null;
  } | null>(null);

  protected readonly materialesFiltrados = computed(() =>
    this.materiales().filter((m) => m.idEspecialidad === this.valores().idEspecialidad),
  );

  protected readonly cantidad = cantidadInventario;

  ngOnInit(): void {
    const fila = this.filas()[0];
    if (!fila) return;

    this.form.patchValue({
      idKardexSalida: fila.idKardexSalida,
      idEspecialidad: fila.idEspecialidad,
      idProyecto: fila.idProyecto,
      numeroDocumento: fila.numeroDocumento ?? '',
      fecha: fila.fecha,
      solicitante: fila.solicitante,
      observacion: fila.observacion ?? '',
    });

    this.filas().forEach((item) =>
      this.form.controls.items.push(controlesItemSalida(itemDesdeSalida(item, this.materiales()))),
    );
  }

  protected abrirItem(indice: number | null = null): void {
    if (this.guardando() || !this.valores().idEspecialidad) return;

    this.editor.set({ indice, item: indice === null ? null : this.valores().items[indice] });
  }

  protected guardarItem(item: ItemBorradorSalida): void {
    const editor = this.editor();
    if (!editor) return;

    const controles = controlesItemSalida(item);
    if (editor.indice === null) this.form.controls.items.push(controles);
    else this.form.controls.items.setControl(editor.indice, controles);

    this.editor.set(null);
  }

  protected quitarItem(indice: number): void {
    if (!this.guardando() && confirm('¿Quitar este ítem de la salida?'))
      this.form.controls.items.removeAt(indice);
  }

  protected reset(): void {
    if (this.guardando()) return;

    this.form.reset();
    this.form.controls.items.clear();
    this.editor.set(null);
    this.msg.set('');
  }

  protected solicitarCierre(): void {
    if (!this.guardando() && !this.editor()) this.cerrar.emit();
  }

  protected guardar(): void {
    if (this.guardando() || this.editor()) return;

    const dto = peticionSalida(this.form.getRawValue());
    if (typeof dto === 'string') {
      this.msg.set(dto);
      return;
    }

    const id = dto.idKardexSalida;
    const operacion = id ? this.registro.actualizarSalida(id, dto) : this.registro.crearSalida(dto);

    this.guardando.set(true);
    this.msg.set('');
    this.form.disable();

    operacion
      .pipe(
        finalize(() => {
          this.guardando.set(false);
          this.form.enable();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          this.guardada.emit(
            id ? 'Salida actualizada correctamente.' : 'Salida registrada correctamente.',
          ),
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudo guardar la salida.')),
      });
  }
}
