import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { descargarArchivo } from '../../app/core/utils/file-download.util';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { GastoDirectoDocumento, GastoDirectoListado } from '../contratos-gastos-directos';
import { ConsultaGastos } from '../consulta-gastos';
import { RegistroGastosDirectos } from '../registro-gastos-directos';

@Component({
  selector: 'documentos-gasto',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './documentos-gasto.html',
  styleUrl: '../gastos-directos.css',
})
export class DocumentosGasto implements OnInit {
  private readonly registro = inject(RegistroGastosDirectos);
  private readonly sesion = inject(SesionUsuario);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly gasto = input.required<GastoDirectoListado>();
  readonly puedeOperar = input(false);

  readonly cancelar = output<void>();
  readonly actualizado = output<void>();

  private readonly selectorArchivos = viewChild<ElementRef<HTMLInputElement>>('selectorArchivos');

  protected readonly consulta = new ConsultaGastos<GastoDirectoDocumento>(
    'No se pudieron cargar los documentos.',
  );
  protected readonly tipoDocumento = signal<'Factura' | 'Pago'>('Factura');
  protected readonly archivos = signal<File[]>([]);
  protected readonly subiendo = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.consulta.cargar(this.registro.documentos(this.gasto().idGastoDirecto));
  }

  protected onArchivosSeleccionados(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.archivos.set(Array.from(event.target.files ?? []));
  }

  protected subirDocumentos(): void {
    if (
      this.subiendo() ||
      !this.puedeOperar() ||
      !this.sesion.hasPermission('gasto_directo.operar')
    )
      return;
    if (!this.archivos().length) {
      this.error.set('Selecciona al menos un PDF.');
      return;
    }
    if (this.archivos().some((archivo) => !archivo.name.toLowerCase().endsWith('.pdf'))) {
      this.error.set('Solo se permiten archivos PDF.');
      return;
    }
    if (this.archivos().reduce((total, archivo) => total + archivo.size, 0) >= 50_000_000) {
      this.error.set('El envío debe ser menor de 50 MB.');
      return;
    }

    this.error.set('');
    this.subiendo.set(true);
    this.registro
      .subirDocumentos(this.gasto().idGastoDirecto, this.tipoDocumento(), this.archivos())
      .pipe(
        finalize(() => this.subiendo.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.archivos.set([]);
          const selector = this.selectorArchivos()?.nativeElement;
          if (selector) selector.value = '';
          this.notifications.show('Documentos adjuntados.', 'success');
          this.cargar();
          this.actualizado.emit();
        },
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudieron adjuntar los documentos.')),
      });
  }

  protected descargar(documento: GastoDirectoDocumento): void {
    if (!documento.tieneArchivo) return;
    this.registro
      .descargarDocumento(this.gasto().idGastoDirecto, documento.idGastoDirectoDocumento)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => descargarArchivo(blob, documento.nombreArchivo || 'documento.pdf'),
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudo descargar el documento.')),
      });
  }

  protected cerrar(): void {
    if (!this.subiendo()) this.cancelar.emit();
  }
}
