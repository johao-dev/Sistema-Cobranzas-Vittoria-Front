import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-materiales-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './materiales.page.html',
  styleUrl: './materiales.page.css'
})
export class MaterialesPage implements OnInit {
  rows: any[] = [];
  especialidades: any[] = [];
  unidadesMedida: any[] = [];
  filtroEspecialidad: number | null = null;
  msg = '';

  form: any = {
    idMaterial: null,
    idEspecialidad: null,
    codigo: '',
    descripcion: '',
    unidadMedida: '',
    stockMinimo: 0,
    activo: true
  };

  constructor(private maestra: MaestraService) {}

  ngOnInit() {
    this.maestra.especialidades(true).subscribe(x => {
      this.especialidades = x || [];
    });

    this.maestra.unidadesMedida(true).subscribe(x => {
      this.unidadesMedida = x || [];
    });

    this.load();
  }

  load() {
    this.maestra.materiales(undefined, this.filtroEspecialidad).subscribe(x => {
      this.rows = x || [];
    });
  }

  edit(row: any) {
    this.form = {
      idMaterial: row.idMaterial ?? null,
      idEspecialidad: row.idEspecialidad != null ? Number(row.idEspecialidad) : null,
      codigo: row.codigo ?? '',
      descripcion: row.descripcion ?? '',
      unidadMedida: row.unidadMedida ?? '',
      stockMinimo: row.stockMinimo != null ? Number(row.stockMinimo) : 0,
      activo: row.activo ?? true
    };

    this.msg = '';
  }

  reset() {
    this.form = {
      idMaterial: null,
      idEspecialidad: null,
      codigo: '',
      descripcion: '',
      unidadMedida: '',
      stockMinimo: 0,
      activo: true
    };

    this.msg = '';
  }

  save() {
    const payload = {
      idMaterial: this.form.idMaterial ? Number(this.form.idMaterial) : null,
      idEspecialidad: this.form.idEspecialidad != null ? Number(this.form.idEspecialidad) : 0,
      codigo: (this.form.codigo ?? '').toString().trim(),
      descripcion: (this.form.descripcion ?? '').toString().trim(),
      unidadMedida: (this.form.unidadMedida ?? '').toString().trim(),
      stockMinimo: this.form.stockMinimo != null && this.form.stockMinimo !== ''
        ? Number(this.form.stockMinimo)
        : 0,
      activo: !!this.form.activo
    };

    if (!payload.idEspecialidad || payload.idEspecialidad <= 0) {
      this.msg = 'Debes seleccionar una especialidad válida.';
      return;
    }

    if (!payload.descripcion) {
      this.msg = 'Debes ingresar la descripción.';
      return;
    }

    if (!payload.unidadMedida) {
      this.msg = 'Debes seleccionar la unidad de medida.';
      return;
    }

    this.maestra.guardarMaterial(payload).subscribe({
      next: () => {
        this.msg = payload.idMaterial
          ? 'Material actualizado correctamente.'
          : 'Material guardado correctamente.';

        this.reset();
        this.load();
      },
      error: e => {
        console.log('ERROR GUARDAR MATERIAL', e);
        console.log('PAYLOAD MATERIAL', payload);

        const apiErrors = e?.error?.errors;
        if (apiErrors) {
          const mensajes = Object.values(apiErrors).flat().join(' ');
          this.msg = mensajes || 'No se pudo guardar el material.';
          return;
        }

        this.msg = e?.error?.message || 'No se pudo guardar el material.';
      }
    });
  }
}