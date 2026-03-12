import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../core/services/compras.service';

@Component({
  standalone: true,
  selector: 'app-compras-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './compras.page.html',
  styleUrl: './compras.page.css'
})
export class ComprasPage implements OnInit {
  pendientes: any[] = [];
  comprasCerradas: any[] = [];
  detalleOc: any = null;
  detalleCompra: any = null;
  documentos: any[] = [];
  selectedFiles: File[] = [];
  msg = '';

  form: any = {
    numeroCompra: '',
    idOrdenCompra: null,
    idProveedor: null,
    fechaCompra: '',
    montoTotal: 0,
    observacion: ''
  };

  constructor(private compras: ComprasService) {}

  ngOnInit() { this.load(); }

  load() {
    this.compras.pendientesCompra().subscribe({
      next: (x: any) => this.pendientes = x || [],
      error: () => this.pendientes = []
    });

    this.compras.compras().subscribe({
      next: (x: any) => this.comprasCerradas = x || [],
      error: () => this.comprasCerradas = []
    });
  }

  procesarPendiente(row: any) {
    const idOrdenCompra = row.idOrdenCompra || row.IdOrdenCompra;
    this.compras.orden(idOrdenCompra).subscribe({
      next: (x: any) => {
        this.detalleOc = x;
        this.detalleCompra = null;

        const oc = x?.ordenCompra;
        const items = x?.items || [];
        const total = items.reduce((acc: number, it: any) => acc + Number(it.subtotal || 0), 0);

        this.form = {
          numeroCompra: '',
          idOrdenCompra: oc?.idOrdenCompra ?? oc?.IdOrdenCompra ?? null,
          idProveedor: oc?.idProveedor ?? oc?.IdProveedor ?? null,
          fechaCompra: '',
          montoTotal: total,
          observacion: ''
        };

        this.documentos = [];
        this.selectedFiles = [];
        this.msg = 'OC cargada para continuar el flujo de compra.';
      },
      error: () => {
        this.detalleOc = null;
        this.msg = 'No se pudo cargar la OC pendiente.';
      }
    });
  }

  verCompra(row: any) {
    const idCompra = row.idCompra || row.IdCompra;
    this.compras.compra(idCompra).subscribe({
      next: (x: any) => {
        this.detalleCompra = x;
        this.detalleOc = null;
        this.documentos = x?.documentos || [];
      },
      error: () => {
        this.detalleCompra = null;
        this.msg = 'No se pudo cargar la compra.';
      }
    });
  }

  onFilesSelected(event: any) {
    const files = Array.from(event?.target?.files || []) as File[];
    this.selectedFiles = files.filter((f: File) => f.name.toLowerCase().endsWith('.pdf'));
    if (!this.selectedFiles.length && files.length) this.msg = 'Solo se permiten archivos PDF.';
  }

  registrarCompra() {
    const dto = {
      numeroCompra: (this.form.numeroCompra || '').trim(),
      idOrdenCompra: Number(this.form.idOrdenCompra),
      idProveedor: Number(this.form.idProveedor),
      fechaCompra: this.form.fechaCompra,
      montoTotal: Number(this.form.montoTotal || 0),
      observacion: this.form.observacion || ''
    };

    if (!dto.idOrdenCompra) { this.msg = 'Debes seleccionar una OC pendiente.'; return; }
    if (!dto.numeroCompra) { this.msg = 'Debes ingresar el número de compra.'; return; }
    if (!dto.idProveedor) { this.msg = 'Debe existir un proveedor en la OC.'; return; }
    if (!dto.fechaCompra) { this.msg = 'Debes ingresar la fecha de compra.'; return; }
    if (!this.selectedFiles.length) { this.msg = 'Debes adjuntar al menos un PDF antes de registrar la compra.'; return; }

    this.compras.registrarCompra(dto).subscribe({
      next: (res: any) => {
        const idCompra = res?.idCompra || res?.IdCompra;
        if (!idCompra) {
          this.msg = 'La compra se registró, pero no se obtuvo el identificador.';
          this.load();
          return;
        }

        this.compras.uploadDocumentosCompra(idCompra, this.selectedFiles).subscribe({
          next: () => {
            this.msg = 'Compra registrada y documentos subidos correctamente.';
            this.selectedFiles = [];
            this.resetForm();
            this.load();
          },
          error: (e: any) => {
            this.msg = e?.error?.message || 'La compra se registró, pero falló la subida de documentos.';
            this.load();
          }
        });
      },
      error: (e: any) => this.msg = e?.error?.message || 'No se pudo registrar la compra.'
    });
  }

  resetForm() {
    this.detalleOc = null;
    this.form = {
      numeroCompra: '',
      idOrdenCompra: null,
      idProveedor: null,
      fechaCompra: '',
      montoTotal: 0,
      observacion: ''
    };
  }
}
