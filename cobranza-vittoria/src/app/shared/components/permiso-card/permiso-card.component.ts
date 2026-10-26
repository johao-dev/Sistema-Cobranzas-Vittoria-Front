import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Permiso } from '../../../models/permisos.models';

@Component({
  standalone: true,
  selector: 'app-permiso-card',
  imports: [CommonModule],
  templateUrl: './permiso-card.component.html',
  styleUrl: './permiso-card.component.css',
})
export class PermisoCardComponent {
  permiso = input.required<Permiso>();

  toggle = output<boolean>();
  edit = output<void>();
  bloqueado = input(false);

  menuOpen = signal(false);

  onToggle(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const activo = input.checked;
    input.checked = this.permiso().activo;
    if (!this.bloqueado()) this.toggle.emit(activo);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  onEdit(): void {
    this.closeMenu();
    this.edit.emit();
  }
}
