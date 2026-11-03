import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { filtrarRegistrosAccesos } from '../../busqueda-accesos';
import { Rol } from '../contratos-roles';
import { RegistroRoles } from '../registro-roles';
import { FormularioRol } from '../formulario-rol/formulario-rol';

@Component({
  selector: 'lista-roles',
  imports: [FormsModule, FormularioRol],
  templateUrl: './lista-roles.html',
  styleUrl: '../../listas-accesos.css',
})
export class ListaRoles implements OnInit {
  private readonly registro = inject(RegistroRoles);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  private consulta?: Subscription;
  protected readonly rows = signal<Rol[]>([]);
  protected readonly filtroBusqueda = signal('');
  protected readonly filtroActivo = signal<boolean | null>(null);
  protected readonly cargando = signal(false);
  protected readonly errorListado = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly seleccionado = signal<Rol | null>(null);
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
      .roles(this.filtroActivo())
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (filas) => this.rows.set(filas),
        error: (error: unknown) => {
          this.rows.set([]);
          const mensaje = extraerMensajeError(error, 'No se pudieron cargar los roles.');
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
  protected seleccionar(fila: Rol): void {
    this.seleccionado.set(fila);
    this.modalOpen.set(true);
  }
}
