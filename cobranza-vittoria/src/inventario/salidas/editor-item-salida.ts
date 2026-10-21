import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { Especialidad } from '../../catalogos/especialidades/contratos-especialidades';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { ItemBorradorSalida } from './datos-salida';

@Component({
  selector: 'inventario-editor-item-salida',
  imports: [FormsModule, DialogoModal],
  templateUrl: './editor-item-salida.html',
  styleUrl: '../presentacion-inventario/presentacion-inventario.css',
})
export class EditorItemSalida implements OnInit {
  readonly especialidades = input.required<readonly Especialidad[]>();
  readonly materiales = input.required<readonly Material[]>();
  readonly item = input<ItemBorradorSalida | null>(null);

  readonly cerrar = output<void>();
  readonly guardar = output<ItemBorradorSalida>();

  protected readonly idEspecialidad = signal<number | null>(null);
  protected readonly idMaterial = signal<number | null>(null);
  protected readonly cantidad = signal<number | null>(0);
  protected readonly observacion = signal('');
  protected readonly error = signal('');

  protected readonly materialesFiltrados = computed(() =>
    this.materiales().filter((material) => material.idEspecialidad === this.idEspecialidad()),
  );

  ngOnInit(): void {
    const item = this.item();
    if (item) {
      const material = this.materiales().find(
        (material) => material.idMaterial === item.idMaterial,
      );

      this.idEspecialidad.set(material?.idEspecialidad ?? null);
      this.idMaterial.set(item.idMaterial);
      this.cantidad.set(item.cantidad);
      this.observacion.set(item.observacion);
    }
  }

  protected cambiarEspecialidad(idEspecialidad: number | null): void {
    this.idEspecialidad.set(idEspecialidad);
    this.idMaterial.set(null);
  }

  protected confirmar(): void {
    if (!this.idEspecialidad()) {
      this.error.set('Debes seleccionar una especialidad.');
      return;
    }

    const material = this.materialesFiltrados().find((m) => m.idMaterial === this.idMaterial());
    if (!material) {
      this.error.set('Debes seleccionar un material.');
      return;
    }

    const cantidad = this.cantidad() ?? 0;
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      this.error.set('La cantidad debe ser mayor o igual a 0.');
      return;
    }
    if (this.observacion().trim().length > 250) {
      this.error.set('La observación admite hasta 250 caracteres.');
      return;
    }

    this.guardar.emit({
      idMaterial: material.idMaterial,
      codigoMaterial: material.codigo || '',
      nombre: material.descripcion,
      unidadMedida: material.unidadMedida,
      cantidad,
      observacion: this.observacion().trim(),
    });
  }
}
