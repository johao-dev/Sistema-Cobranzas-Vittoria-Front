import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PermisoCardComponent } from '../../shared/components/permiso-card/permiso-card.component';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';
import { CreatePermisoRequest, Permiso, UpdatePermisoRequest } from '../../models/permisos.models';

@Component({
    standalone: true,
    selector: 'app-permisos-page',
    imports: [CommonModule, FormsModule, PermisoCardComponent],
    templateUrl: './permisos.page.html',
    styleUrl: './permisos.page.css'
})
export class PermisosPage implements OnInit {
    permisosListado: Permiso[] = [];
    cargando = false;
    filtroBusqueda = '';
    filtroActivo: boolean | null = null;
    msg = '';
    modalOpen = false;
    form: Permiso = { idPermiso: 0, codigo: '', nombre: '', descripcion: '', activo: true };

    constructor(
        private seguridad: SeguridadService,
        private notifyService: NotificationService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.cargando = true;
        this.seguridad.permisos(this.filtroActivo).subscribe({
            next: (res) => {
                this.permisosListado = res?.permisos || [];
                this.cargando = false;
                this.cdr.detectChanges();
            },
            error: (e) => {
                this.permisosListado = [];
                this.cargando = false;
                this.cdr.detectChanges();
                console.error('Error cargando permisos:', e);
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
            codigo: row.codigo ?? '',
            nombre: row.nombre ?? '',
            descripcion: row.descripcion ?? '',
            activo: row.activo ?? true
        };
        this.modalOpen = true;
        this.cdr.detectChanges();
    }

    reset(): void {
        this.form = { idPermiso: 0, codigo: '', nombre: '', descripcion: '', activo: true };
        this.msg = '';
    }

    save(): void {
        const nombre = (this.form.nombre ?? '').toString().trim();
        const descripcion = (this.form.descripcion ?? '').toString().trim();
        const codigo = (this.form.codigo ?? '').toString().trim().toLowerCase();

        if (!nombre) {
            this.msg = 'Debes ingresar el nombre de la acción.';
            this.notifyService.show(this.msg, 'error');
            return;
        }

        if (!this.form.idPermiso && !codigo) {
            this.msg = 'Debes ingresar el código de la acción.';
            this.notifyService.show(this.msg, 'error');
            return;
        }

        const esEdicion = !!this.form.idPermiso;

        if (esEdicion) {
            this.seguridad.actualizarPermiso(this.form.idPermiso, { nombre, descripcion }).subscribe({
                next: () => {
                    this.msg = 'Acción actualizada correctamente.';
                    this.notifyService.show(this.msg, 'success');
                    this.reset();
                    this.cerrarModal();
                    this.load();
                },
                error: (e: any) => {
                    this.msg = e?.error?.message || 'No se pudo actualizar la acción.';
                    this.notifyService.show(this.msg, 'error');
                    this.cdr.detectChanges();
                }
            });
            return;
        }

        this.seguridad.crearPermiso({ codigo: codigo.replace(/\s+/g, '.'), nombre, descripcion }).subscribe({
            next: () => {
                this.msg = 'Acción guardada correctamente.';
                this.notifyService.show(this.msg, 'success');
                this.reset();
                this.cerrarModal();
                this.load();
            },
            error: (e: any) => {
                this.msg = e?.error?.message || 'No se pudo guardar la acción.';
                this.notifyService.show(this.msg, 'error');
                this.cdr.detectChanges();
            }
        });
    }

    onToggle(row: Permiso, activo: boolean): void {
        // La API no expone endpoint para cambiar solo el estado; el controlador
        // no permite editar activo. Se actualiza localmente hasta que exista endpoint.
        row.activo = activo;
        this.cdr.detectChanges();
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