import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { NotificationService } from '../../app/core/services/notification.service';
import { extraerMensajeError, obtenerErrores } from '../../app/core/utils/api-error.util';
import { RegistroPresupuestos } from '../registro-presupuestos';
import {
  ResultadoCargaPresupuesto,
  ResultadoEstructuraPresupuesto,
} from '../contratos-presupuestos';
import { DetalleErrorValidacion } from '../../shared/errores-api/contratos-error-validacion';
import {
  descargarArchivo,
  extraerFilenameDeContentDisposition,
} from '../../app/core/utils/file-download.util';

@Component({
  selector: 'importacion-presupuesto',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './importacion-presupuesto.html',
  styleUrls: ['../dialogos-presupuesto.css', './importacion-presupuesto.css'],
})
export class ImportacionPresupuesto {
  private readonly destroyRef = inject(DestroyRef);
  private readonly registroPresupuestos = inject(RegistroPresupuestos);
  private readonly notifications = inject(NotificationService);
  readonly cerrar = output<void>();
  readonly idPresupuesto = input.required<number>();
  readonly idVersion = input.required<number>();
  readonly numeroVersion = input.required<number>();
  readonly simbolo = input('');
  readonly estructura = input(false);
  readonly importado = output<ResultadoEstructuraPresupuesto | null>();
  protected readonly guardando = signal(false);
  protected readonly archivoImportar = signal<File | null>(null);
  protected readonly quitarAusentesImportar = signal(false);
  protected readonly resultadoImportar = signal<ResultadoCargaPresupuesto | null>(null);
  protected readonly erroresImportar = signal<DetalleErrorValidacion[]>([]);
  protected readonly mensajeErrorImportar = signal('');
  protected readonly descargandoPlantilla = signal(false);
  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }

  private limpiarResultadoImportar(): void {
    this.resultadoImportar.set(null);
    this.erroresImportar.set([]);
    this.mensajeErrorImportar.set('');
  }

  onArchivoImportar(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0] ?? null;
    this.limpiarResultadoImportar();
    this.archivoImportar.set(null);
    if (file && !/\.(csv|xlsx|xls)$/i.test(file.name)) {
      this.notifications.show('Usa un archivo CSV, XLSX o XLS.', 'error');
      input.value = '';
    } else if (file && file.size > 5 * 1024 * 1024) {
      this.notifications.show('El archivo supera el tamaño máximo de 5 MB.', 'error');
      input.value = '';
    } else {
      this.archivoImportar.set(file);
    }
  }

  importar(): void {
    if (this.guardando()) return;
    const archivo = this.archivoImportar();
    if (!archivo) return;
    this.guardando.set(true);
    this.limpiarResultadoImportar();
    this.registroPresupuestos
      .importarPresupuesto(
        this.idPresupuesto(),
        this.idVersion(),
        archivo,
        this.quitarAusentesImportar(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.resultadoImportar.set(r);
          this.notifications.show('Montos importados correctamente.', 'success');
          this.importado.emit(null);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.erroresImportar.set(obtenerErrores(err));
          this.mensajeErrorImportar.set(
            extraerMensajeError(err, 'No se pudo importar el archivo.'),
          );
          // Con errores por fila los muestra la tabla del modal; el aviso queda para el resto.
          if (!this.erroresImportar().length)
            this.notifications.show(this.mensajeErrorImportar(), 'error');
        },
      });
  }

  importarEstructura(): void {
    if (this.guardando()) return;
    const archivo = this.archivoImportar();
    if (!archivo) return;
    this.guardando.set(true);
    this.limpiarResultadoImportar();
    this.registroPresupuestos
      .importarEstructura(
        this.idPresupuesto(),
        this.idVersion(),
        archivo,
        this.quitarAusentesImportar(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.guardando.set(false);

          this.notifications.show(
            `Estructura importada: ${r?.partidasCreadas ?? 0} partida(s) nueva(s) en el catálogo.`,
            'success',
          );
          this.importado.emit(r);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.erroresImportar.set(obtenerErrores(err));
          this.mensajeErrorImportar.set(
            extraerMensajeError(err, 'No se pudo importar el archivo.'),
          );
          if (!this.erroresImportar().length)
            this.notifications.show(this.mensajeErrorImportar(), 'error');
        },
      });
  }

  descargarPlantilla(formato: 'csv' | 'xlsx', tipo: 'montos' | 'estructura' = 'montos'): void {
    if (this.descargandoPlantilla()) return;
    this.descargandoPlantilla.set(true);
    const idPresupuesto = this.idPresupuesto();
    const idVersion = this.idVersion();
    const peticion =
      tipo === 'estructura'
        ? this.registroPresupuestos.plantillaEstructura(idPresupuesto, idVersion, formato)
        : this.registroPresupuestos.plantillaPresupuesto(idPresupuesto, idVersion, formato);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.descargandoPlantilla.set(false);
        if (resp.body) {
          const nombre = extraerFilenameDeContentDisposition(
            resp.headers.get('Content-Disposition'),
            tipo === 'estructura'
              ? `plantilla-estructura.${formato}`
              : `plantilla-presupuesto.${formato}`,
          );
          descargarArchivo(resp.body, nombre);
        }
      },
      error: () => {
        this.descargandoPlantilla.set(false);
        this.notifications.show('No se pudo descargar la plantilla.', 'error');
      },
    });
  }

  filaExcel(fila: number | string | null | undefined): number | string {
    if (fila === null || fila === undefined) return '—';
    const n = Number(fila);
    return isNaN(n) ? (fila ?? '—') : n + 1;
  }
}
