import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PermisoCardComponent } from '../../shared/components/permiso-card/permiso-card.component';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';
import { Permiso } from '../../models/permisos.models';

@Component({
    standalone: true,
    selector: 'app-permisos-page',
    imports: [CommonModule, FormsModule, PermisoCardComponent],
    templateUrl: './permisos.page.html',
    styleUrl: './permisos.page.css'
})
export class PermisosPage implements OnInit {
    permisosListado: Permiso[] = [];
    filtroBusqueda = '';
    filtroActivo: boolean | null = null;
    msg = '';
    modalOpen = false;
    form: Permiso = { idPermiso: undefined, nombre: '', descripcion: '', activo: true };

    constructor(
        private seguridad: SeguridadService,
        private notifyService: NotificationService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.seguridad.permisos(this.filtroActivo).subscribe({
            next: (data) => {
                this.permisosListado = data || [];
                this.cdr.detectChanges();
            },
            error: () => {
                this.permisosListado = [];
                this.cdr.detectChanges();
            }
        });
    }

    private normalizarBusqueda(valor: any): string {
        return (valor ?? '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    get rowsFiltradas(): Permiso[] {
        const termino = this.normalizarBusqueda(this.filtroBusqueda);
        if (!termino) return this.permisosListado ?? [];

        return (this.permisosListado ?? []).filter((row) =>
            this.normalizarBusqueda(`${row.nombre} ${row.descripcion ?? ''}`).includes(termino)
        );
    }

    abrirModalNuevo(): void {
        this.reset();
        this.modalOpen = true;
        this.cdr.detectChanges();
    }

    cerrarModal(): void {
        this.modalOpen = false;
        this.cdr.detectChanges();
    }

    edit(row: Permiso): void {
        this.form = {
            idPermiso: row.idPermiso,
            nombre: row.nombre ?? '',
            descripcion: row.descripcion ?? '',
            activo: row.activo ?? true
        };
        this.modalOpen = true;
        this.cdr.detectChanges();
    }

    reset(): void {
        this.form = { idPermiso: undefined, nombre: '', descripcion: '', activo: true };
        this.msg = '';
    }

    save(): void {
        const payload: Permiso = {
            idPermiso: this.form.idPermiso,
            nombre: (this.form.nombre ?? '').toString().trim(),
            descripcion: (this.form.descripcion ?? '').toString().trim(),
            activo: !!this.form.activo
        };

        if (!payload.nombre) {
            this.msg = 'Debes ingresar el nombre de la acción.';
            this.notifyService.show(this.msg, 'error');
            return;
        }

        this.seguridad.guardarPermiso(payload).subscribe({
            next: () => {
                this.msg = payload.idPermiso ? 'Acción actualizada correctamente.' : 'Acción guardada correctamente.';
                this.notifyService.show(this.msg, 'success');
                this.reset();
                this.cerrarModal();
                this.load();
            },
            error: (e) => {
                this.msg = e?.error?.message || 'No se pudo guardar la acción.';
                this.notifyService.show(this.msg, 'error');
                this.cdr.detectChanges();
            }
        });
    }

    onToggle(row: Permiso, activo: boolean): void {
        const payload = { ...row, activo };
        this.seguridad.guardarPermiso(payload).subscribe({
            next: () => {
                row.activo = activo;
                this.notifyService.show('Estado actualizado correctamente.', 'success');
                this.cdr.detectChanges();
            },
            error: (e) => {
                this.notifyService.show(e?.error?.message || 'No se pudo actualizar el estado.', 'error');
                this.cdr.detectChanges();
            }
        });
    }

    onDelete(row: Permiso): void {
        if (!row.idPermiso) return;
        if (!confirm('¿Estás seguro de eliminar esta acción?')) return;

        this.seguridad.eliminarPermiso(row.idPermiso).subscribe({
            next: () => {
                this.notifyService.show('Acción eliminada correctamente.', 'success');
                this.load();
            },
            error: (e) => {
                this.notifyService.show(e?.error?.message || 'No se pudo eliminar la acción.', 'error');
            }
        });
    }
}