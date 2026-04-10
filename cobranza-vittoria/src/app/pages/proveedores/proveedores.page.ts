import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  constructor(private maestra: MaestraService, private notifyService: NotificationService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.maestra.proveedores().subscribe(x => {
      this.rows = x || [];
      this.cdr.detectChanges();
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

      this.msg = '';
      this.cdr.detectChanges();
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

    this.msg = '';
  }

  buscarRuc() {
    if (!this.form.ruc || this.form.ruc.toString().trim().length !== 11) {
      return;
    }

    this.maestra.consultaRuc(this.form.ruc).subscribe({
      next: (res: any) => {
        if (res && res.numero_documento) {
          this.form.razonSocial = res.razon_social || '';
          this.form.direccion = res.direccion !== '-' ? (res.direccion || '') : '';
          this.form.activo = res.estado === 'ACTIVO';
          
          this.msg = 'Datos recuperados de SUNAT correctamente.';
          this.notifyService.show(this.msg, 'success');
        } else {
          this.msg = 'No se encontraron datos para el RUC ingresado.';
          this.notifyService.show(this.msg, 'info');
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.msg = 'Error al consultar el RUC. Verifique el número ingresado.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  save() {
    this.maestra.guardarProveedor(this.form).subscribe({
      next: (resp: any) => {
        const idProveedor = resp?.idProveedor ?? this.form.idProveedor ?? null;

        if (idProveedor) {
          this.form.idProveedor = idProveedor;
        }

        this.msg = 'Proveedor guardado correctamente.';
        this.notifyService.show(this.msg, 'success');

        this.load();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo guardar el proveedor.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
