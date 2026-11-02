import { Component, input, output, signal } from '@angular/core';

import { Permiso } from '../contratos-permisos';

@Component({
  standalone: true,
  selector: 'tarjeta-permiso',
  imports: [],
  templateUrl: './tarjeta-permiso.html',
  styleUrl: './tarjeta-permiso.css',
})
export class TarjetaPermiso {
  readonly permiso = input.required<Permiso>();

  readonly cambiarEstado = output<boolean>();
  readonly editar = output<void>();
  readonly bloqueado = input(false);

  protected readonly menuOpen = signal(false);

  protected onToggle(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const activo = input.checked;
    input.checked = this.permiso().activo;
    if (!this.bloqueado()) this.cambiarEstado.emit(activo);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onEdit(): void {
    this.closeMenu();
    this.editar.emit();
  }
}
