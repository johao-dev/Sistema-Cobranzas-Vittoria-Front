import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-proyectos-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './proyectos.page.html',
  styleUrls: ['./proyectos.page.css']
})
export class ProyectosPage implements OnInit {
  rows: any[] = [];
  form: any = {
    idProyecto: null,
    nombreProyecto: '',
    descripcion: '',
    activo: true
  };

  msg = '';
  saving = false;

  constructor(
    private maestra: MaestraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(this.maestra.proyectos());
      this.rows = data ?? [];
    } catch {
      this.rows = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  edit(row: any): void {
    this.form = {
      idProyecto: row.idProyecto,
      nombreProyecto: row.nombreProyecto ?? '',
      descripcion: row.descripcion ?? '',
      activo: row.activo ?? true
    };
    this.msg = '';
    this.cdr.detectChanges();
  }

  async save(): Promise<void> {
    this.msg = '';

    if (!this.form.nombreProyecto?.trim()) {
      this.msg = 'Debes ingresar el nombre del proyecto.';
      this.cdr.detectChanges();
      return;
    }

    const isEdit = !!this.form.idProyecto;

    const dto = {
      idProyecto: this.form.idProyecto,
      nombreProyecto: this.form.nombreProyecto.trim(),
      descripcion: this.form.descripcion ?? '',
      activo: !!this.form.activo
    };

    console.log('DTO proyecto =>', dto);

    this.saving = true;
    this.cdr.detectChanges();

    try {
      const res = await firstValueFrom(this.maestra.guardarProyecto(dto));
      console.log('Respuesta proyecto =>', res);

      this.msg = isEdit
        ? `Proyecto editado correctamente. ID: ${res?.idProyecto ?? this.form.idProyecto ?? ''}`
        : `Proyecto guardado correctamente. ID: ${res?.idProyecto ?? ''}`;

      this.reset(false);
      await this.load();
    } catch (e: any) {
      console.error('Error guardando proyecto =>', e);
      this.msg = e?.error?.message || 'No se pudo guardar el proyecto.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  reset(clearMessage: boolean = false): void {
    this.form = {
      idProyecto: null,
      nombreProyecto: '',
      descripcion: '',
      activo: true
    };

    if (clearMessage) {
      this.msg = '';
    }

    this.cdr.detectChanges();
  }
}