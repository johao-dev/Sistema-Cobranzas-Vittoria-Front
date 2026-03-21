import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({ standalone:true, selector:'app-usuarios-page', imports:[CommonModule, FormsModule], templateUrl:'./usuarios.page.html', styleUrl:'./usuarios.page.css' })
export class UsuariosPage implements OnInit {
  rows:any[]=[]; roles:any[]=[]; detalle:any=null; filtroActivo:boolean|null=null; roleId:number|null=null; msg='';
  form:any={ nombres:'', apellidos:'', correo:'', usuarioLogin:'', passwordHash:'', activo:true, usuarioCreacion:'admin' };
  constructor(private seguridad: SeguridadService, private notifyService: NotificationService){}
  ngOnInit(){ this.seguridad.roles().subscribe(x=>this.roles=x); this.load(); }
  load(){ this.seguridad.usuarios(this.filtroActivo).subscribe(x=>this.rows=x); }
  select(row:any){ this.seguridad.usuario(row.idUsuario).subscribe(res=>{ this.detalle=res; this.form={...res.usuario, passwordHash: res.usuario.passwordHash || ''}; }); }
  reset(){ this.detalle=null; this.form={ nombres:'', apellidos:'', correo:'', usuarioLogin:'', passwordHash:'', activo:true, usuarioCreacion:'admin' }; }
  save(){ const req = this.form.idUsuario ? this.seguridad.actualizarUsuario(this.form.idUsuario, this.form) : this.seguridad.crearUsuario(this.form); req.subscribe({ next:()=>{ this.msg='Usuario guardado correctamente.'; this.notifyService.show(this.msg, 'success'); this.load(); }, error:e=> { this.msg=e?.error?.message || 'No se pudo guardar el usuario.'; this.notifyService.show(this.msg, 'error'); } }); }
  asignarRol(){ if(!this.form.idUsuario || !this.roleId) return; this.seguridad.asignarRol(this.form.idUsuario, this.roleId).subscribe({ next:()=>{ this.msg='Rol asignado correctamente.'; this.notifyService.show(this.msg, 'success'); this.select({ idUsuario: this.form.idUsuario }); }, error:e=> { this.msg=e?.error?.message || 'No se pudo asignar el rol.'; this.notifyService.show(this.msg, 'error'); } }); }
}
