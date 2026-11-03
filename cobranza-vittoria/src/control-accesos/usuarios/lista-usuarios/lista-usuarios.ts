import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { filtrarRegistrosAccesos } from '../../busqueda-accesos';
import { Usuario } from '../contratos-usuarios';
import { RegistroUsuarios } from '../registro-usuarios';
import { FormularioUsuario } from '../formulario-usuario/formulario-usuario';

@Component({
  selector: 'lista-usuarios',
  imports: [FormsModule, FormularioUsuario],
  templateUrl: './lista-usuarios.html',
  styleUrl: '../../listas-accesos.css',
})
export class ListaUsuarios implements OnInit {
  private readonly registro = inject(RegistroUsuarios);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  private consulta?: Subscription;
  protected readonly rows = signal<Usuario[]>([]);
  protected readonly filtroBusqueda = signal('');
  protected readonly filtroActivo = signal<boolean | null>(null);
  protected readonly cargando = signal(false);
  protected readonly errorListado = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly seleccionado = signal<Usuario | null>(null);
  protected readonly rowsFiltradas = computed(() =>
    filtrarRegistrosAccesos(this.rows(), this.filtroBusqueda()),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.consulta?.unsubscribe();
    this.cargando.set(true);
    this.errorListado.set('');
    this.consulta = this.registro
      .usuarios(this.filtroActivo())
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (filas) => this.rows.set(filas),
        error: (error: unknown) => {
          this.rows.set([]);
          const mensaje = extraerMensajeError(error, 'No se pudieron cargar los usuarios.');
          this.errorListado.set(mensaje);
          this.notificaciones.show(mensaje, 'error');
        },
      });
  }
  protected abrirModalNuevo(): void {
    this.seleccionado.set(null);
    this.modalOpen.set(true);
  }
  protected cerrarModal(): void {
    this.modalOpen.set(false);
    this.seleccionado.set(null);
  }
  protected seleccionar(fila: Usuario): void {
    this.seleccionado.set(fila);
    this.modalOpen.set(true);
  }
}
