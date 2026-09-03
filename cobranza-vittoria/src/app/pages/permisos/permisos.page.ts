import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PermisoCardComponent } from '../../shared/components/permiso-card/permiso-card.component';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';
import { Permiso } from '../../models/permisos.models';

// TODO: BORRAR cuando el backend ya devuelva permisos reales.
// Estos registros son solo para visualizar la interfaz mientras no haya datos.
// Para eliminarlos:
// 1. Borra la constante PERMISOS_ESTATICOS.
// 2. En load(), quita la concatenación con PERMISOS_ESTATICOS.
// 3. En onToggle() y onDelete(), quita las guardas que ignoran registros estáticos.
const PERMISOS_ESTATICOS: Permiso[] = [
    {
        idPermiso: -1,
        nombre: 'Crear Requerimientos',
        descripcion: 'Permite crear requerimientos en el sistema.',
        activo: true
    },
    {
        idPermiso: -2,
        nombre: 'Aprobar Órdenes de Compra',
        descripcion: 'Permite aprobar órdenes de compra pendientes.',
        activo: false
    },
    {
        idPermiso: -3,
        nombre: 'Administrar Usuarios',
        descripcion: 'Permite crear, editar y desactivar usuarios.',
        activo: true
    }
];

function esPermisoEstatico(row: Permiso): boolean {
    return row.idPermiso !== undefined && row.idPermiso < 0;
}

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
        this.cargando = false;

        // TODO: descomentar el bloque de abajo cuando el backend ya tenga /api/seguridad/permisos.
        // Por ahora usamos solo registros estáticos para visualizar la interfaz.
        this.permisosListado = [...PERMISOS_ESTATICOS];
        this.cdr.detectChanges();

        /*
        this.cargando = true;
        this.seguridad.permisos(this.filtroActivo).subscribe({
            next: (data) => {
                this.permisosListado = data || [];
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
        */
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
        // TODO: quitar esta guarda cuando se eliminen los permisos estáticos.
        if (esPermisoEstatico(row)) {
            row.activo = activo;
            this.cdr.detectChanges();
            return;
        }

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

        // TODO: quitar esta guarda cuando se eliminen los permisos estáticos.
        if (esPermisoEstatico(row)) {
            this.permisosListado = this.permisosListado.filter((p) => p.idPermiso !== row.idPermiso);
            this.notifyService.show('Registro de ejemplo eliminado.', 'success');
            this.cdr.detectChanges();
            return;
        }

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