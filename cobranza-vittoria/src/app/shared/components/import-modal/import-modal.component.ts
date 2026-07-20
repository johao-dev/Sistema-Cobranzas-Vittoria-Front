import {
  Component,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImportService } from '../../../core/services/import.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ImportModulo,
  ImportResultado,
  IMPORT_MODULOS_META,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_EXTENSIONS,
  ImportFilaError,
  ImportModuloMeta
} from '../../../models/import.models';

@Component({
  selector: 'app-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-modal.component.html',
  styleUrl: './import-modal.component.css'
})
export class ImportModalComponent implements OnInit {
  @Input({ required: true }) modulo!: ImportModulo;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSuccess = new EventEmitter<number>();

  archivo: File | null = null;
  loading = false;
  resultado: ImportResultado | null = null;
  readonly meta = signal<ImportModuloMeta | null>(null);

  private importsSvc = inject(ImportService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.meta.set(IMPORT_MODULOS_META[this.modulo]);
  }

  cerrar() {
    if (this.loading) return;
    this.onClose.emit();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.archivo = null;
    this.resultado = null;

    if (!file) return;

    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext as any)) {
      this.notify.show(`Extensión no permitida. Use: ${ACCEPTED_EXTENSIONS.join(', ')}`, 'error');
      input.value = '';
      this.cdr.detectChanges();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(2);
      this.notify.show(`El archivo (${mb} MB) supera el tamaño máximo de 10 MB.`, 'error');
      input.value = '';
      this.cdr.detectChanges();
      return;
    }

    this.archivo = file;
    this.cdr.detectChanges();
  }

  descargarPlantilla() {
    const meta = this.meta();
    if (!meta) return;
    const header = [...meta.columnasRequeridas, ...meta.columnasOpcionales].join(',');
    const blob = new Blob([header + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla-${meta.modulo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  subir() {
    if (!this.archivo) return;
    const usuario = this.auth.session?.usuarioLogin ?? '';
    if (!usuario) {
      this.notify.show('No hay sesión activa.', 'error');
      return;
    }

    this.loading = true;
    this.resultado = null;
    this.cdr.detectChanges();

    this.importsSvc.importar(this.modulo, this.archivo, usuario).subscribe(r => {
      this.loading = false;
      this.resultado = r;
      this.cdr.detectChanges();

      if (r.ok) {
        this.notify.show(
          `Importación exitosa: ${r.data.filasInsertadas} fila(s) insertada(s).`,
          'success'
        );
        this.onSuccess.emit(r.data.filasInsertadas);
        return;
      }

      // En 422 la tabla de errores se renderiza en el modal; no usamos toast.
      if (r.error.error === 'DATOS_INVALIDOS') {
        return;
      }
      this.notify.show(r.error.message, 'error');
    });
  }

  trackError(_: number, e: ImportFilaError) {
    return `${e.fila}-${e.campo}-${e.codigoError}`;
  }
}
