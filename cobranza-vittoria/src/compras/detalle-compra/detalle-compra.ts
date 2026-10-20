import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { finalize, switchMap } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { RegistroCompras } from '../registro-compras';
import { CompraDetalleResponse, CompraDocumentoFilaSql } from '../contratos-compras';
import { archivosSeleccionados } from '../formulario-compra/datos-compra';
@Component({
  selector: 'compra-detalle',
  imports: [CommonModule, DialogoModal],
  templateUrl: './detalle-compra.html',
  styleUrls: ['../presentacion-compras.css', './detalle-compra.css'],
})
export class DetalleCompra implements OnInit {
  private readonly registro = inject(RegistroCompras);
  private readonly destroyRef = inject(DestroyRef);
  readonly idCompra = input.required<number>();
  readonly cerrar = output<void>();
  protected readonly detalle = signal<CompraDetalleResponse | null>(null);
  protected readonly cargando = signal(false);
  protected readonly subiendo = signal(false);
  protected readonly archivos = signal<File[]>([]);
  protected readonly msg = signal('');
  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.msg.set('');
    this.registro
      .compra(this.idCompra())
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle) => this.detalle.set(detalle),
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudo cargar la compra.')),
      });
  }

  protected seleccionar(event: Event): void {
    this.archivos.set(archivosSeleccionados(event));
  }

  protected solicitarCierre(): void {
    if (!this.subiendo()) this.cerrar.emit();
  }

  protected subir(): void {
    if (this.subiendo()) return;
    if (!this.archivos().length) {
      this.msg.set('Debes seleccionar al menos un archivo.');
      return;
    }
    this.subiendo.set(true);
    this.msg.set('');
    // La recarga forma parte de la misma operación; nunca vuelve a enviarse el registro de compra.
    this.registro
      .uploadDocumentosCompra(this.idCompra(), this.archivos())
      .pipe(
        switchMap(() => {
          this.archivos.set([]);
          this.msg.set('Archivos subidos correctamente.');
          return this.registro.compra(this.idCompra());
        }),
        finalize(() => this.subiendo.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle) => this.detalle.set(detalle),
        error: (error: unknown) =>
          this.msg.set(extraerMensajeError(error, 'No se pudieron actualizar los documentos.')),
      });
  }

  protected descargar(documento: CompraDocumentoFilaSql): void {
    window.open(
      this.registro.documentoCompraDownloadUrl(this.idCompra(), documento.IdCompraDocumento),
      '_blank',
      'noopener',
    );
  }
}
