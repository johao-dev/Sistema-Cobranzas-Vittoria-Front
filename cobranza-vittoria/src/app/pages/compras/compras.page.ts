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
    incluyeIgv: true,
    subtotalSinIgv: 0,
    montoIgv: 0,
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
        this.detalleCompra = null;

        const oc = x?.ordenCompra;
        const items = (x?.items || []).map((it: any) => ({
          ...it,
          precioUnitario: Number(it.precioUnitario || it.PrecioUnitario || 0)
        }));
        this.detalleOc = { ...x, items };
        const total = items.reduce((acc: number, it: any) => {
          const cantidad = Number(it.cantidad || it.Cantidad || 0);
          const pu = Number(it.precioUnitario || it.PrecioUnitario || 0);
          return acc + (cantidad * pu);
        }, 0);

        this.form = {
          numeroCompra: '',
          idOrdenCompra: oc?.idOrdenCompra ?? oc?.IdOrdenCompra ?? null,
          idProveedor: oc?.idProveedor ?? oc?.IdProveedor ?? null,
          fechaCompra: '',
          incluyeIgv: true,
          subtotalSinIgv: this.redondear(total / 1.18),
          montoIgv: this.redondear(total - (total / 1.18)),
          montoTotal: this.redondear(total),
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
        const compra = x?.compra || x || {};
        this.form.incluyeIgv = compra?.incluyeIGV ?? compra?.IncluyeIGV ?? compra?.incluyeIgv ?? true;
        this.form.subtotalSinIgv = Number(compra?.subtotalSinIGV ?? compra?.SubtotalSinIGV ?? compra?.subtotalSinIgv ?? 0);
        this.form.montoIgv = Number(compra?.montoIGV ?? compra?.MontoIGV ?? compra?.montoIgv ?? 0);
        this.form.montoTotal = Number(compra?.montoTotal ?? compra?.MontoTotal ?? 0);
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
      incluyeIGV: !!this.form.incluyeIgv,
      subtotalSinIGV: this.subtotalSinIgvCalculado,
      montoIGV: this.montoIgvCalculado,
      montoTotal: this.montoTotalCalculado,
      observacion: this.form.observacion || '',
      items: (this.detalleOc?.items || []).map((item: any) => ({
        idMaterial: Number(item.idMaterial || item.IdMaterial || 0),
        cantidad: Number(item.cantidad || item.Cantidad || 0),
        precioUnitario: Number(item.precioUnitario || item.PrecioUnitario || 0)
      }))
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

  get montoBaseCalculado(): number {
    const items = this.detalleOc?.items || [];
    return this.redondear(items.reduce((acc: number, item: any) => {
      const cantidad = Number(item.cantidad || item.Cantidad || 0);
      const pu = Number(item.precioUnitario || item.PrecioUnitario || 0);
      return acc + (cantidad * pu);
    }, 0));
  }

  get subtotalSinIgvCalculado(): number {
    if (this.form.incluyeIgv) {
      return this.redondear(this.montoBaseCalculado / 1.18);
    }
    return this.redondear(this.montoBaseCalculado);
  }

  get montoIgvCalculado(): number {
    if (this.form.incluyeIgv) {
      return this.redondear(this.montoBaseCalculado - this.subtotalSinIgvCalculado);
    }
    return this.redondear(this.montoBaseCalculado * 0.18);
  }

  get montoTotalCalculado(): number {
    if (this.form.incluyeIgv) {
      return this.redondear(this.montoBaseCalculado);
    }
    return this.redondear(this.subtotalSinIgvCalculado + this.montoIgvCalculado);
  }

  formatFechaSolo(valor: any): string {
    if (!valor) return '-';
    const raw = String(valor);
    if (raw.includes('T')) return raw.slice(0, 10);
    if (raw.includes(' ')) return raw.slice(0, 10);
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }

  private redondear(valor: number): number {
    return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
  }

  resetForm() {
    this.detalleOc = null;
    this.form = {
      numeroCompra: '',
      idOrdenCompra: null,
      idProveedor: null,
      fechaCompra: '',
      incluyeIgv: true,
      subtotalSinIgv: 0,
      montoIgv: 0,
      montoTotal: 0,
      observacion: ''
    };
  }
}
