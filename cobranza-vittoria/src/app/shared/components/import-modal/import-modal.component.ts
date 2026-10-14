import {
  Component,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ImportService } from '../../../core/services/import.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ImportModulo,
  ImportResumen,
  ImportResultado,
  ImportErrorResponse,
  IMPORT_MODULOS_META,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_EXTENSIONS,
  ImportFilaError,
  ImportDetalleFila,
  ImportModuloMeta,
  MaterialPlantillaFormato,
} from '../../../models/import.models';

@Component({
  selector: 'app-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-modal.component.html',
  styleUrl: './import-modal.component.css',
})
export class ImportModalComponent implements OnInit {
  @Input({ required: true }) modulo!: ImportModulo;
  /** Formato de la plantilla a descargar. Por defecto XLSX. */
  @Input() plantillaFormato: MaterialPlantillaFormato = 'xlsx';
  @Output() onClose = new EventEmitter<void>();
  @Output() onSuccess = new EventEmitter<number>();

  archivo: File | null = null;
  loading = false;
  descargandoPlantilla = false;
  resultado: ImportResultado | null = null;
  errorArchivo = '';
  readonly meta = signal<ImportModuloMeta | null>(null);

  private importsSvc = inject(ImportService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.meta.set(IMPORT_MODULOS_META[this.modulo]);
  }

  cerrar() {
    if (this.loading || this.descargandoPlantilla) return;
    this.quitarArchivo();
    this.onClose.emit();
  }

  get extensiones(): readonly string[] {
    return this.meta()?.extensiones ?? ACCEPTED_EXTENSIONS;
  }

  get maxFileSizeBytes(): number {
    return this.meta()?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
  }

  get maxMb(): number {
    return this.maxFileSizeBytes / (1024 * 1024);
  }

  get puedeImportar(): boolean {
    const permiso = this.meta()?.permiso;
    return !permiso || this.auth.hasPermission(permiso);
  }

  get importado(): boolean {
    return this.resultado?.ok === true;
  }

  get resumen(): Partial<ImportResumen> | null {
    return this.resultado ? (this.resultado.ok ? this.resultado.data : this.resultado.error) : null;
  }

  get tamanoArchivo(): string {
    const bytes = this.archivo?.size ?? 0;
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;
  }

  quitarArchivo(): void {
    if (this.loading || this.descargandoPlantilla) return;
    this.archivo = null;
    this.resultado = null;
    this.errorArchivo = '';
  }

  onFileSelected(event: Event) {
    if (this.loading || this.descargandoPlantilla) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    this.quitarArchivo();
    // Permite volver a elegir el mismo archivo, también después de un rechazo.
    input.value = '';
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!this.extensiones.includes(ext)) {
      this.errorArchivo = `Extensión no permitida. Use: ${this.extensiones.join(', ')}`;
    } else if (file.size > this.maxFileSizeBytes) {
      this.errorArchivo = `El archivo supera el tamaño máximo de ${this.maxMb} MB.`;
    } else {
      this.archivo = file;
    }
    if (this.errorArchivo) this.notify.show(this.errorArchivo, 'error');
    this.cdr.detectChanges();
  }

  descargarPlantilla() {
    if (this.descargandoPlantilla || this.loading || !this.puedeImportar) return;

    this.descargandoPlantilla = true;
    this.cdr.detectChanges();

    this.importsSvc
      .descargarPlantilla(this.modulo, this.plantillaFormato)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.descargandoPlantilla = false;
        this.cdr.detectChanges();

        if (r.ok) return;

        this.notify.show(r.message ?? 'No se pudo descargar la plantilla.', 'error');
      });
  }

  subir() {
    if (
      !this.archivo ||
      this.loading ||
      this.descargandoPlantilla ||
      this.importado ||
      !this.puedeImportar
    )
      return;
    const usuario = this.auth.session?.usuarioLogin ?? '';
    if (this.meta()?.enviarUsuario !== false && !usuario) {
      this.notify.show('No hay sesión activa.', 'error');
      return;
    }

    this.loading = true;
    this.resultado = null;
    this.cdr.detectChanges();

    this.importsSvc
      .importar(this.modulo, this.archivo, usuario)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((r) => {
        this.loading = false;
        this.resultado = r;
        this.cdr.detectChanges();

        if (r.ok) {
          this.notify.show(
            `Importación exitosa: ${r.data.filasInsertadas} fila(s) insertada(s).`,
            'success',
          );
          this.onSuccess.emit(r.data.filasInsertadas);
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
      });
  }

  trackError(_: number, e: ImportFilaError) {
    return `${e.fila}-${e.campo}-${e.codigoError}`;
  }

  trackDetalle(_: number, e: ImportDetalleFila) {
    return `${e._fila}-${e.mensaje}`;
  }

  get tieneDetalles(): boolean {
    return !!this.errorActual?.detalles?.length;
  }

  get tieneErrores(): boolean {
    return !!this.errorActual?.errores?.length;
  }

  get errorActual(): ImportErrorResponse | null {
    if (!this.resultado || this.resultado.ok) return null;
    return this.resultado.error;
  }
}
