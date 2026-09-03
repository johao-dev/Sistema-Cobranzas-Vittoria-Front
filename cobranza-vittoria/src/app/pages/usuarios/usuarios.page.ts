import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({ standalone: true, selector: 'app-usuarios-page', imports: [CommonModule, FormsModule], templateUrl: './usuarios.page.html', styleUrl: './usuarios.page.css' })
export class UsuariosPage implements OnInit {
  modalOpen = false;

  abrirModalNuevo(): void {
    this.reset();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  rows: any[] = [];
  filtroBusqueda = '';

  private normalizarBusqueda(valor: any): string {
    return (valor ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizarBusqueda(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];

    return (this.rows ?? []).filter(row =>
      this.normalizarBusqueda(Object.values(row ?? {}).join(' ')).includes(termino)
    );
  }
  roles: any[] = []; detalle: any = null; filtroActivo: boolean | null = null; roleId: number | null = null; msg = '';
  form: any = { nombres: '', apellidos: '', correo: '', usuarioLogin: '', passwordHash: '', activo: true, usuarioCreacion: 'admin' };
  constructor(private seguridad: SeguridadService, private notifyService: NotificationService, private cdr: ChangeDetectorRef) { }
  ngOnInit() { this.seguridad.roles().subscribe(x => { this.roles = x; this.cdr.detectChanges(); }); this.load(); }
  load() { this.seguridad.usuarios(this.filtroActivo).subscribe(x => { this.rows = x; this.cdr.detectChanges(); }); }
  select(row: any) { this.modalOpen = true; this.seguridad.usuario(row.idUsuario).subscribe(res => { this.detalle = res; this.form = { ...res.usuario, passwordHash: res.usuario.passwordHash || '' }; this.cdr.detectChanges(); }); }
  reset() { this.detalle = null; this.form = { nombres: '', apellidos: '', correo: '', usuarioLogin: '', passwordHash: '', activo: true, usuarioCreacion: 'admin' }; }
  save() { const req = this.form.idUsuario ? this.seguridad.actualizarUsuario(this.form.idUsuario, this.form) : this.seguridad.crearUsuario(this.form); req.subscribe({ next: () => { this.msg = 'Usuario guardado correctamente.'; this.notifyService.show(this.msg, 'success'); this.reset(); this.cerrarModal(); this.load(); this.cdr.detectChanges(); }, error: e => { this.msg = e?.error?.message || 'No se pudo guardar el usuario.'; this.notifyService.show(this.msg, 'error'); this.cdr.detectChanges(); } }); }
  asignarRol() { if (!this.form.idUsuario || !this.roleId) return; this.seguridad.asignarRol(this.form.idUsuario, this.roleId).subscribe({ next: () => { this.msg = 'Rol asignado correctamente.'; this.notifyService.show(this.msg, 'success'); this.select({ idUsuario: this.form.idUsuario }); this.cdr.detectChanges(); }, error: e => { this.msg = e?.error?.message || 'No se pudo asignar el rol.'; this.notifyService.show(this.msg, 'error'); this.cdr.detectChanges(); } }); }
}
