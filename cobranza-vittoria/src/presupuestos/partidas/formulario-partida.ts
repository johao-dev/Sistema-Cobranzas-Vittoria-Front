import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { PartidaCatalogo } from './contratos-partidas';
import { BorradorPartida } from './borrador-partida';
import { TipoPartida } from '../contratos-catalogos-presupuestarios';
import { CatalogoPartidas } from './catalogo-partidas';

@Component({
  selector: 'formulario-partida',
  imports: [CommonModule, FormsModule, DialogoModal],
  templateUrl: './formulario-partida.html',
  styleUrls: ['../dialogos-presupuesto.css'],
})
export class FormularioPartida implements OnInit {
  private readonly catalogoPartidas = inject(CatalogoPartidas);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(Notificaciones);
  readonly valor = input<PartidaCatalogo | null>(null);
  readonly guardado = output<void>();
  readonly cerrar = output<void>();
  protected readonly guardando = signal(false);
  readonly tipos = input.required<TipoPartida[]>();
  readonly rows = input.required<PartidaCatalogo[]>();
  protected form: BorradorPartida = this.formVacio();

  ngOnInit(): void {
    const row = this.valor();
    if (!row) return;
    this.form = {
      idCatalogoPartida: row.idCatalogoPartida,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      idTipoPartida: row.idTipoPartida ?? '',
      idPartidaPadre: row.idPartidaPadre ?? '',
      descripcion: row.descripcion ?? '',
      activo: row.activo ?? true,
      esHoja: row.esHoja,
    };
  }
  formVacio(): BorradorPartida {
    return {
      idCatalogoPartida: null,
      codigo: '',
      nombre: '',
      idTipoPartida: '',
      idPartidaPadre: '',
      descripcion: '',
      activo: true,
      esHoja: true,
    };
  }

  get esEdicion(): boolean {
    return !!this.form.idCatalogoPartida;
  }

  get partidasPadreDisponibles(): PartidaCatalogo[] {
    const actual = this.form.idCatalogoPartida;
    return (this.rows() ?? []).filter((r) => r.activo && r.idCatalogoPartida !== actual);
  }

  save(): void {
    if (this.guardando()) return;
    if (!this.esEdicion && !String(this.form.codigo ?? '').trim()) {
      this.notifications.show('Ingresa el código de la partida.', 'info');
      return;
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre de la partida.', 'info');
      return;
    }
    if (!this.form.idTipoPartida) {
      this.notifications.show('Selecciona el tipo de partida.', 'info');
      return;
    }

    this.guardando.set(true);
    this.catalogoPartidas
      .guardarPartida(this.form)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notifications.show('Partida guardada correctamente.', 'success');
          this.guardado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo guardar la partida.'),
            'error',
          );
        },
      });
  }
  protected cerrarFormulario(): void {
    if (!this.guardando()) this.cerrar.emit();
  }
}
