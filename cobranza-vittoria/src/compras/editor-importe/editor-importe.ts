import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import {
  PrecioItem,
  archivosSeleccionados,
  recalcularImporte,
} from '../formulario-compra/datos-compra';
@Component({
  selector: 'compra-editor-importe',
  imports: [FormsModule, DialogoModal],
  templateUrl: './editor-importe.html',
  styleUrls: ['../presentacion-compras.css', './editor-importe.css'],
})
export class EditorImporte implements OnInit {
  readonly item = input.required<PrecioItem>();
  readonly guardar = output<PrecioItem>();
  readonly cerrar = output<void>();
  protected readonly borrador = signal<PrecioItem | null>(null);
  protected readonly error = signal('');
  protected readonly monto = signal<number | null>(null);

  ngOnInit(): void {
    this.borrador.set({ ...this.item(), files: [...this.item().files] });
    this.monto.set(this.item().total);
  }

  protected cambiarMonto(monto: number | null): void {
    this.monto.set(monto);
    this.borrador.update((item) =>
      item ? recalcularImporte({ ...item, total: monto ?? 0 }) : null,
    );
  }

  protected cambiarIgv(incluyeIgv: boolean): void {
    this.borrador.update((item) => (item ? recalcularImporte({ ...item, incluyeIgv }) : null));
  }

  protected seleccionar(event: Event): void {
    const archivos = archivosSeleccionados(event);
    this.borrador.update((item) =>
      item ? { ...item, files: [...item.files, ...archivos] } : null,
    );
    if (event.target instanceof HTMLInputElement) event.target.value = '';
  }

  protected quitar(indice: number): void {
    this.borrador.update((item) =>
      item ? { ...item, files: item.files.filter((_, i) => i !== indice) } : null,
    );
  }

  protected confirmar(): void {
    const item = this.borrador();
    if (!item || this.monto() === null || !Number.isFinite(item.total) || item.total <= 0) {
      this.error.set('Ingresa un monto total positivo.');
      return;
    }
    this.guardar.emit(recalcularImporte(item));
  }
}
