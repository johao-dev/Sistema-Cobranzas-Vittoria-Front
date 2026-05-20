import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../core/services/compras.service';
import { MaestraService } from '../../core/services/maestra.service';
import { SeguridadService } from '../../core/services/seguridad.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-ordenes-compra-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './ordenes-compra.page.html',
  styleUrl: './ordenes-compra.page.css'
})
export class OrdenesCompraPage implements OnInit {
  rqPendientesOc: any[] = [];
  ordenesCreadas: any[] = [];
  proveedores: any[] = [];
  proyectos: any[] = [];
  usuarios: any[] = [];
  detalleRq: any = null;
  detalleOc: any = null;
  msg = '';
  flujoModalOpen = false;
  detalleModalOpen = false;
  proveedorModalOpen = false;
  proveedorForm: any = this.createEmptyProveedorForm();

  form: any = {
    numeroOrdenCompra: '',
    idRequerimiento: null,
    idProveedor: null,
    idProyecto: null,
    fechaOrdenCompra: '',
    descripcion: '',
    idUsuarioCreacion: null,
    usuarioCreacionNombre: '',
    proyectoNombre: '',
    rutaPdf: '',
    items: []
  };

  constructor(
    private compras: ComprasService,
    private maestra: MaestraService,
    private seguridad: SeguridadService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  onAccionRq(event: Event, row: any): void {
    const value = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (value === 'procesar') this.procesarRq(row);
  }



  onAccionOrdenGenerada(event: Event, row: any): void {
    const value = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (value === 'detalle') this.verOc(row);
    if (value === 'pdf') this.exportarPdfOrden(row);
  }

  abrirNuevoProveedor(): void {
    this.proveedorForm = this.createEmptyProveedorForm();
    this.proveedorModalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarProveedorModal(): void {
    this.proveedorModalOpen = false;
    this.cdr.detectChanges();
  }

  guardarNuevoProveedor(): void {
    if (!String(this.proveedorForm.razonSocial || '').trim()) {
      this.msg = 'Ingresa la razón social del proveedor.';
      return;
    }

    this.maestra.guardarProveedor(this.proveedorForm).subscribe({
      next: () => {
        this.msg = 'Proveedor creado correctamente.';
        this.cerrarProveedorModal();
        this.loadCatalogos();
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo crear el proveedor.';
        this.cdr.detectChanges();
      }
    });
  }

  buscarRucProveedor(): void {
    if (!this.proveedorForm.ruc || this.proveedorForm.ruc.toString().trim().length !== 11) {
      return;
    }

    this.maestra.consultaRuc(this.proveedorForm.ruc).subscribe({
      next: (res: any) => {
        if (res && res.numero_documento) {
          this.proveedorForm.razonSocial = res.razon_social || '';
          this.proveedorForm.direccion = res.direccion !== '-' ? (res.direccion || '') : '';
          this.proveedorForm.activo = res.estado === 'ACTIVO';
          
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

  cerrarFlujoModal(): void {
    this.flujoModalOpen = false;
    this.cdr.detectChanges();
  }

  cerrarDetalleModal(): void {
    this.detalleModalOpen = false;
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.load();
    this.loadCatalogos();
  }

  load() {
    this.compras.requerimientos({ estado: 'EnviadoOC' }).subscribe({
      next: (x: any) => { this.rqPendientesOc = x || []; this.cdr.detectChanges(); },
      error: () => { this.rqPendientesOc = []; this.cdr.detectChanges(); }
    });

    this.compras.ordenes().subscribe({
      next: (x: any) => { this.ordenesCreadas = x || []; this.cdr.detectChanges(); },
      error: () => { this.ordenesCreadas = []; this.cdr.detectChanges(); }
    });
  }

  loadCatalogos() {
    this.maestra.proveedores(true).subscribe({ next: (x: any) => { this.proveedores = x || []; this.cdr.detectChanges(); }, error: () => { this.proveedores = []; this.cdr.detectChanges(); } });
    this.maestra.proyectos(true).subscribe({ next: (x: any) => { this.proyectos = x || []; this.cdr.detectChanges(); }, error: () => { this.proyectos = []; this.cdr.detectChanges(); } });
    this.seguridad.usuarios().subscribe({ next: (x: any) => { this.usuarios = x || []; this.cdr.detectChanges(); }, error: () => { this.usuarios = []; this.cdr.detectChanges(); } });
  }

  procesarRq(row: any) {
    this.compras.requerimiento(row.idRequerimiento).subscribe({
      next: (x: any) => {
        this.detalleRq = x;
        this.detalleOc = null;
        this.flujoModalOpen = true;
        this.detalleModalOpen = false;

        const req = x?.requerimiento;
        const items = x?.items || [];

        this.form.idRequerimiento = req?.idRequerimiento ?? null;
        this.form.idProyecto = req?.idProyecto ?? null;
        this.form.proyectoNombre = req?.nombreProyecto || row?.nombreProyecto || row?.NombreProyecto || '';
        this.form.idUsuarioCreacion = req?.idUsuarioSolicitante ?? row?.idUsuarioSolicitante ?? null;
        this.form.usuarioCreacionNombre = req?.solicitante || row?.solicitante || '';
        this.form.numeroOrdenCompra = this.getNextNumeroOrdenCompra();
        this.form.fechaOrdenCompra = this.todayIso();
        this.form.items = items.map((it: any) => ({
          especialidad: it.especialidad || req?.especialidad || row?.especialidad || '-',
          idMaterial: it.idMaterial,
          material: it.material,
          unidadMedida: it.unidadMedida,
          cantidad: Number(it.cantidad),
          idProveedor: null,
          precioUnitario: 0
        }));

        this.msg = 'RQ cargado para continuar flujo de O.C.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.detalleRq = null;
        this.msg = 'No se pudo cargar el requerimiento.';
        this.cdr.detectChanges();
      }
    });
  }

  verOc(row: any) {
    this.compras.orden(row.idOrdenCompra).subscribe({
      next: (x: any) => {
        const ordenCompra = x?.ordenCompra ?? {};
        const especialidades = ordenCompra.especialidades || ordenCompra.especialidad || row?.especialidades || row?.especialidad || '-';
        const numeroRequerimiento = ordenCompra.numeroRequerimiento || row?.numeroRequerimiento || '-';
        this.detalleOc = {
          ...x,
          ordenCompra: {
            ...ordenCompra,
            especialidades,
            especialidad: ordenCompra.especialidad || especialidades,
            numeroRequerimiento
          },
          items: (x?.items || []).map((item: any) => ({
            ...item,
            especialidad: item.especialidad || especialidades
          }))
        };
        this.detalleRq = null;
        this.detalleModalOpen = true;
        this.flujoModalOpen = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detalleOc = null;
        this.msg = 'No se pudo cargar la orden.';
        this.cdr.detectChanges();
      }
    });
  }

  save() {
    const dto = {
      numeroOrdenCompra: (this.form.numeroOrdenCompra || '').trim() || this.getNextNumeroOrdenCompra(),
      idRequerimiento: Number(this.form.idRequerimiento),
      idProveedor: Number((this.form.items || []).find((x: any) => Number(x.idProveedor))?.idProveedor || 0),
      idProyecto: Number(this.form.idProyecto),
      fechaOrdenCompra: this.form.fechaOrdenCompra || this.todayIso(),
      descripcion: '',
      idUsuarioCreacion: this.form.idUsuarioCreacion ? Number(this.form.idUsuarioCreacion) : null,
      rutaPdf: '',
      items: (this.form.items || []).map((x: any) => ({
        idMaterial: Number(x.idMaterial),
        cantidad: Number(x.cantidad),
        idProveedor: Number(x.idProveedor || 0),
        precioUnitario: 0
      }))
    };

    if (!dto.idRequerimiento) { this.msg = 'Debes seleccionar un RQ enviado a O.C.'; return; }
    if (!dto.idProyecto) { this.msg = 'Debes seleccionar proyecto.'; return; }
    if (!dto.fechaOrdenCompra) { this.msg = 'Debes ingresar la fecha.'; return; }
    if (!dto.items.length) { this.msg = 'La orden debe tener ítems.'; return; }
    if (dto.items.some((x: any) => !x.idProveedor)) { this.msg = 'Debes seleccionar proveedor por cada material.'; return; }

    this.compras.crearOrden(dto).subscribe({
      next: () => {
        this.msg = 'Orden creada correctamente.';
        this.resetFormulario();
        this.flujoModalOpen = false;
        this.load();
      },
      error: (e: any) => { this.msg = e?.error?.message || 'No se pudo guardar la orden.'; this.cdr.detectChanges(); }
    });
  }

  resetFormulario() {
    this.detalleRq = null;
    this.flujoModalOpen = false;
    this.form = {
      numeroOrdenCompra: '',
      idRequerimiento: null,
      idProveedor: null,
      idProyecto: null,
      fechaOrdenCompra: '',
      descripcion: '',
      idUsuarioCreacion: null,
      usuarioCreacionNombre: '',
      proyectoNombre: '',
      rutaPdf: '',
      items: []
    };
  }


  exportarPdfListado(): void {
    const tabla = document.getElementById('tabla-ordenes-compra-generadas-export');
    if (!tabla) return;

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html>
      <head>
        <title>Listado de órdenes de compra</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1f2430; }
          h1 { font-size: 20px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d6deea; padding: 8px; text-align: left; }
          th { background: #f5f7fb; }
        </style>
      </head>
      <body>
        <h1>Listado de órdenes de compra</h1>
        ${tabla.outerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }


  exportarPdfOrden(row: any): void {
    const id = Number(row?.idOrdenCompra || 0);
    if (!id) { this.msg = 'No se encontró la O.C. para exportar.'; return; }

    this.compras.orden(id).subscribe({
      next: (data: any) => this.imprimirOrden(data, row),
      error: () => {
        this.msg = 'No se pudo cargar la O.C. para exportar.';
        this.cdr.detectChanges();
      }
    });
  }

  private imprimirOrden(data: any, fallbackRow?: any): void {
    const oc = data?.ordenCompra || {};
    const numeroRequerimiento = oc.numeroRequerimiento || fallbackRow?.numeroRequerimiento || '-';
    const especialidades = oc.especialidades || oc.especialidad || fallbackRow?.especialidades || fallbackRow?.especialidad || '-';
    const items = (data?.items || []).map((item: any) => ({
      ...item,
      especialidad: item.especialidad || especialidades
    }));
    const win = window.open('', '_blank');
    if (!win) return;

    const rows = items.map((item: any) => `
      <tr>
        <td>${this.escapeHtml(item.especialidad || '-')}</td>
        <td>${this.escapeHtml(item.material || '-')}</td>
        <td>${this.escapeHtml(item.unidadMedida || '-')}</td>
        <td>${Number(item.cantidad || 0).toLocaleString('es-PE')}</td>
        <td>${this.escapeHtml(item.proveedor || '-')}</td>
      </tr>`).join('');

    win.document.write(`
      <html>
      <head>
        <title>Orden de compra ${this.escapeHtml(oc.numeroOrdenCompra || '')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 22px; margin: 0 0 16px; }
          .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; margin-bottom: 18px; font-size: 13px; }
          .meta div { border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d6deea; padding: 8px; text-align: left; }
          th { background: #f5f7fb; }
        </style>
      </head>
      <body>
        <h1>Orden de compra ${this.escapeHtml(oc.numeroOrdenCompra || '')}</h1>
        <div class="meta">
          <div><strong>Fecha:</strong> ${this.escapeHtml(oc.fechaOrdenCompra ? new Date(oc.fechaOrdenCompra).toLocaleDateString('es-PE') : '-')}</div>
          <div><strong>RQ:</strong> ${this.escapeHtml(numeroRequerimiento)}</div>
          <div><strong>Proyecto:</strong> ${this.escapeHtml(oc.nombreProyecto || '-')}</div>
          <div><strong>Proveedor:</strong> ${this.escapeHtml(oc.proveedor || '-')}</div>
          <div><strong>Especialidades:</strong> ${this.escapeHtml(especialidades)}</div>
          <div><strong>Estado:</strong> ${this.escapeHtml(oc.estado || '-')}</div>
        </div>
        <table>
          <thead><tr><th>Especialidad</th><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Proveedor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin detalle</td></tr>'}</tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  private createEmptyProveedorForm(): any {
    return {
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
  }

  private escapeHtml(value: any): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getNextNumeroOrdenCompra(): string {
    const max = (this.ordenesCreadas || []).reduce((acc: number, row: any) => Math.max(acc, this.extractNumericValue(row?.numeroOrdenCompra)), 0);
    return String(max + 1);
  }

  private extractNumericValue(value: any): number {
    const parts = String(value ?? '').match(/\d+/g);
    if (!parts?.length) return 0;
    return Number(parts.join('')) || 0;
  }

  private todayIso(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }
}
