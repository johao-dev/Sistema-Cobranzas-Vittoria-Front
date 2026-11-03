import { Component, input, computed, inject, output, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { DialogoModal } from '../../dialogos/dialogo-modal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistroImportacion } from '../registro-importacion';
import { Notificaciones } from '../../notificaciones/notificaciones';
import { SesionUsuario } from '../../../core/sesion/sesion-usuario';
import {
  ImportModulo,
  ImportResumen,
  ImportResultado,
  ImportErrorResponse,
  ImportFilaError,
  ImportDetalleFila,
  MaterialPlantillaFormato,
} from '../contratos-importacion';
import {
  IMPORT_MODULOS_META,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_EXTENSIONS,
} from '../metadatos-importacion';

@Component({
  selector: 'modal-importacion',
  standalone: true,
  imports: [CommonModule, DialogoModal],
  templateUrl: './modal-importacion.html',
  styleUrl: './modal-importacion.css',
})
export class ModalImportacion {
  private readonly importsSvc = inject(RegistroImportacion);
  private readonly auth = inject(SesionUsuario);
  private readonly notify = inject(Notificaciones);
  private readonly destroyRef = inject(DestroyRef);

  readonly modulo = input.required<ImportModulo>();
  /** Formato de la plantilla a descargar. Por defecto XLSX. */
  readonly plantillaFormato = input<MaterialPlantillaFormato>('xlsx');
  readonly cerrado = output<void>();
  readonly importacionCompletada = output<number>();

  readonly archivo = signal<File | null>(null);
  readonly loading = signal(false);
  readonly descargandoPlantilla = signal(false);
  readonly resultado = signal<ImportResultado | null>(null);
  readonly errorArchivo = signal('');
  protected readonly meta = computed(() => IMPORT_MODULOS_META[this.modulo()]);

  protected readonly extensiones = computed<readonly string[]>(() => {
    return this.meta().extensiones ?? ACCEPTED_EXTENSIONS;
  });

  private readonly maxFileSizeBytes = computed<number>(() => {
    return this.meta().maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
  });

  protected readonly maxMb = computed<number>(() => {
    return this.maxFileSizeBytes() / (1024 * 1024);
  });

  protected readonly puedeImportar = computed<boolean>(() => {
    const permiso = this.meta().permiso;
    return !permiso || this.auth.hasPermission(permiso);
  });

  protected readonly importado = computed<boolean>(() => {
    return this.resultado()?.ok === true;
  });

  readonly resumen = computed<Partial<ImportResumen> | null>(() => {
    const resultado = this.resultado();
    return resultado ? (resultado.ok ? resultado.data : resultado.error) : null;
  });

  protected readonly tamanoArchivo = computed<string>(() => {
    const bytes = this.archivo()?.size ?? 0;
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;
  });

  protected readonly tieneDetalles = computed<boolean>(() => {
    return !!this.errorActual()?.detalles?.length;
  });

  protected readonly tieneErrores = computed<boolean>(() => {
    return !!this.errorActual()?.errores?.length;
  });

  protected readonly errorActual = computed<ImportErrorResponse | null>(() => {
    const resultado = this.resultado();
    return resultado && !resultado.ok ? resultado.error : null;
  });

  cerrar(): void {
    if (this.loading() || this.descargandoPlantilla()) return;

    this.quitarArchivo();
    this.cerrado.emit();
  }

  quitarArchivo(): void {
    if (this.loading() || this.descargandoPlantilla()) return;

    this.archivo.set(null);
    this.resultado.set(null);
    this.errorArchivo.set('');
  }

  protected onFileSelected(event: Event): void {
    if (this.loading() || this.descargandoPlantilla()) return;

    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.quitarArchivo();
    // Permite volver a elegir el mismo archivo, también después de un rechazo.
    input.value = '';
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!this.extensiones().includes(ext)) {
      this.errorArchivo.set(`Extensión no permitida. Use: ${this.extensiones().join(', ')}`);
    } else if (file.size > this.maxFileSizeBytes()) {
      this.errorArchivo.set(`El archivo supera el tamaño máximo de ${this.maxMb()} MB.`);
    } else {
      this.archivo.set(file);
    }
    if (this.errorArchivo()) this.notify.show(this.errorArchivo(), 'error');
  }

  descargarPlantilla(): void {
    if (this.descargandoPlantilla() || this.loading() || !this.puedeImportar()) return;

    this.descargandoPlantilla.set(true);

    this.importsSvc
      .descargarPlantilla(this.modulo(), this.plantillaFormato())
      .pipe(
        finalize(() => this.descargandoPlantilla.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          this.descargandoPlantilla.set(false);

          if (r.ok) return;

          this.notify.show(r.message ?? 'No se pudo descargar la plantilla.', 'error');
        },
        error: () => this.notify.show('No se pudo descargar la plantilla.', 'error'),
      });
  }

  subir(): void {
    const archivo = this.archivo();
    if (
      !archivo ||
      this.loading() ||
      this.descargandoPlantilla() ||
      this.importado() ||
      !this.puedeImportar()
    )
      return;

    const usuario = this.auth.session?.usuarioLogin ?? '';
    if (this.meta().enviarUsuario !== false && !usuario) {
      this.notify.show('No hay sesión activa.', 'error');
      return;
    }

    this.loading.set(true);
    this.resultado.set(null);

    this.importsSvc
      .importar(this.modulo(), archivo, usuario)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (r) => {
          this.loading.set(false);
          this.resultado.set(r);

          if (r.ok) {
            this.notify.show(
              `Importación exitosa: ${r.data.filasInsertadas} fila(s) insertada(s).`,
              'success',
            );
            this.importacionCompletada.emit(r.data.filasInsertadas);
            return;
          }

          // En 422 la tabla de errores se renderiza en el modal; no usamos toast.
          if (
            r.httpStatus === 422 ||
            r.httpStatus === 401 ||
            r.httpStatus === 403 ||
            r.error.error === 'DATOS_INVALIDOS'
          ) {
            return;
          }
          this.notify.show(r.error.message, 'error');
        },
        error: () => this.notify.show('No se pudo importar el archivo.', 'error'),
      });
  }

  protected trackError(_: number, e: ImportFilaError): string {
    return `${e.fila}-${e.campo}-${e.codigoError}`;
  }

  protected trackDetalle(_: number, e: ImportDetalleFila): string {
    return `${e._fila}-${e.mensaje}`;
  }
}
