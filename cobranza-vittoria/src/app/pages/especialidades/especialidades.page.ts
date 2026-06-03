import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';

import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-especialidades-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './especialidades.page.html',
  styleUrl: './especialidades.page.css'
})
export class EspecialidadesPage implements OnInit {
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

  form: any = { nombre: '', descripcion: '', activo: true };
  msg = '';
  constructor(private maestra: MaestraService, private notifyService: NotificationService, private cdr: ChangeDetectorRef) {}
  ngOnInit(){ this.load(); }
  load(){ this.maestra.especialidades().subscribe(x => { this.rows = x; this.cdr.detectChanges(); }); }
  edit(row:any){ this.modalOpen = true; this.form = { ...row }; }
  reset(){ this.form = { nombre: '', descripcion: '', activo: true }; }
  save(){
    this.maestra.guardarEspecialidad(this.form).subscribe({
      next: ()=>{ this.msg='Especialidad guardada correctamente.'; this.notifyService.show(this.msg, 'success'); this.reset(); this.cerrarModal(); this.load(); this.cdr.detectChanges(); },
      error: e => { this.msg = e?.error?.message || 'No se pudo guardar la especialidad.'; this.notifyService.show(this.msg, 'error'); this.cdr.detectChanges(); }
    });
  }
}
