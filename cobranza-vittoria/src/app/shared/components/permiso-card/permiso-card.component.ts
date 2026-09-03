import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Permiso } from '../../../models/permisos.models';

@Component({
    standalone: true,
    selector: 'app-permiso-card',
    imports: [CommonModule],
    templateUrl: './permiso-card.component.html',
    styleUrl: './permiso-card.component.css'
})
export class PermisoCardComponent {
    permiso = input.required<Permiso>();

    toggle = output<boolean>();
    edit = output<void>();
    remove = output<void>();

    menuOpen = signal(false);

    onToggle(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.toggle.emit(checked);
    }

    toggleMenu(): void {
        this.menuOpen.update(open => !open);
    }

    closeMenu(): void {
        this.menuOpen.set(false);
    }

    onEdit(): void {
        this.closeMenu();
        this.edit.emit();
    }

    onRemove(): void {
        this.closeMenu();
        this.remove.emit();
    }
}
