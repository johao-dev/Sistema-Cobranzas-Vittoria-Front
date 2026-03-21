import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';

import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-proveedores-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores.page.html',
  styleUrl: './proveedores.page.css'
})
export class ProveedoresPage implements OnInit {
  rows: any[] = [];
  especialidades: any[] = [];
  especialidadesSeleccionadas: number[] = [];
  especialidadesProveedor: any[] = [];
  filtroEspecialidad: number | null = null;
  msg = '';

  form: any = {
    idProveedor: null,
    razonSocial: '',
    ruc: '',
    contacto: '',
    telefono: '',
    correo: '',
    direccion: '',
    banco: '',
    cuentaCorriente: '',
    cci: '',
    cuentaDetraccion: '',
    descripcionServicio: '',
    observacion: '',
    trabajamosConProveedor: 'SI',
    activo: true
  };

  constructor(private maestra: MaestraService, private notifyService: NotificationService) {}

  ngOnInit() {
    this.maestra.especialidades(true).subscribe(x => (this.especialidades = x || []));
    this.load();
  }

  load() {
    this.maestra.proveedores(undefined, this.filtroEspecialidad).subscribe(x => {
      this.rows = x || [];
    });
  }

  edit(row: any) {
    this.maestra.proveedor(row.idProveedor).subscribe(res => {
      this.form = {
        idProveedor: res?.proveedor?.idProveedor ?? row.idProveedor ?? null,
        razonSocial: res?.proveedor?.razonSocial ?? '',
        ruc: res?.proveedor?.ruc ?? '',
        contacto: res?.proveedor?.contacto ?? '',
        telefono: res?.proveedor?.telefono ?? '',
        correo: res?.proveedor?.correo ?? '',
        direccion: res?.proveedor?.direccion ?? '',
        banco: res?.proveedor?.banco ?? '',
        cuentaCorriente: res?.proveedor?.cuentaCorriente ?? '',
        cci: res?.proveedor?.cci ?? '',
        cuentaDetraccion: res?.proveedor?.cuentaDetraccion ?? '',
        descripcionServicio: res?.proveedor?.descripcionServicio ?? '',
        observacion: res?.proveedor?.observacion ?? '',
        trabajamosConProveedor: res?.proveedor?.trabajamosConProveedor ?? 'SI',
        activo: res?.proveedor?.activo ?? true
      };

      this.especialidadesProveedor = res?.especialidades || [];
      this.especialidadesSeleccionadas = this.especialidadesProveedor
        .filter((x: any) => x.activo)
        .map((x: any) => x.idEspecialidad);

      this.msg = '';
    });
  }

  reset() {
    this.form = {
      idProveedor: null,
      razonSocial: '',
      ruc: '',
      contacto: '',
      telefono: '',
      correo: '',
      direccion: '',
      banco: '',
      cuentaCorriente: '',
      cci: '',
      cuentaDetraccion: '',
      descripcionServicio: '',
      observacion: '',
      trabajamosConProveedor: 'SI',
      activo: true
    };

    this.especialidadesSeleccionadas = [];
    this.especialidadesProveedor = [];
    this.msg = '';
  }

  save() {
    this.maestra.guardarProveedor(this.form).subscribe({
      next: (resp: any) => {
        const idProveedor = resp?.idProveedor ?? this.form.idProveedor ?? null;

        if (idProveedor) {
          this.form.idProveedor = idProveedor;
        }

        this.msg = this.form.idProveedor
          ? 'Proveedor guardado correctamente. Ahora puedes guardar sus especialidades.'
          : 'Proveedor guardado correctamente.';

        this.notifyService.show(this.msg, 'success');

        this.load();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo guardar el proveedor.';
        this.notifyService.show(this.msg, 'error');
      }
    });
  }

  onEspecialidadToggle(idEspecialidad: number, checked: boolean) {
    if (checked) {
      if (!this.especialidadesSeleccionadas.includes(idEspecialidad)) {
        this.especialidadesSeleccionadas = [...this.especialidadesSeleccionadas, idEspecialidad];
      }
      return;
    }

    this.especialidadesSeleccionadas = this.especialidadesSeleccionadas.filter(x => x !== idEspecialidad);
  }

  guardarEspecialidadesProveedor() {
    if (!this.form.idProveedor) {
      this.msg = 'Primero debes guardar el proveedor.';
      return;
    }

    if (!this.especialidades.length) {
      this.msg = 'No hay especialidades disponibles.';
      return;
    }

    const requests = this.especialidades.map((e: any) =>
      this.maestra.setProveedorEspecialidad(this.form.idProveedor, {
        idEspecialidad: e.idEspecialidad,
        activo: this.especialidadesSeleccionadas.includes(e.idEspecialidad)
      })
    );

    if (!requests.length) {
      this.msg = 'No hay especialidades para procesar.';
      return;
    }

    forkJoin(requests.length ? requests : [of(null)]).subscribe({
      next: () => {
        this.msg = 'Especialidades actualizadas correctamente.';
        this.notifyService.show(this.msg, 'success');
        this.load();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudieron actualizar las especialidades.';
        this.notifyService.show(this.msg, 'error');
      }
    });
  }
}