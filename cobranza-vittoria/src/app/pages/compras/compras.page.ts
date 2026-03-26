import { Component, ElementRef, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComprasService } from '../../core/services/compras.service';

type PrecioItem = {
  idMaterial: number;
  especialidad: string;
  material: string;
  unidadMedida: string;
  cantidad: number;
  idProveedor: number | null;
  proveedor: string;
  precioUnitario: number;
  incluyeIgv: boolean;
  subtotalSinIgv: number;
  montoIgv: number;
  total: number;
  observacion: string;
  files: File[];
};

@Component({
  standalone: true,
  selector: 'app-compras-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './compras.page.html',
  styleUrl: './compras.page.css'
})
export class ComprasPage implements OnInit {
  @ViewChild('modalFilesInput') modalFilesInput?: ElementRef<HTMLInputElement>;

  pendientes: any[] = [];
  comprasCerradas: any[] = [];
  detalleOc: any = null;
  detalleCompra: any = null;
  documentos: any[] = [];
  msg = '';

  form = {
    numeroCompra: '',
    idOrdenCompra: null as number | null,
    idProveedor: null as number | null,
    fechaCompra: '',
  };

  filtrosTabla = {
    especialidad: 'TODAS',
    proveedor: 'TODOS'
  };

  itemPrecios: PrecioItem[] = [];
  modalOpen = false;
  modalIndex = -1;
  modalItem: PrecioItem | null = null;

  constructor(private compras: ComprasService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.load();
  }

  load() {
    this.compras.pendientesCompra().subscribe({
      next: (x: any) => { this.pendientes = x || []; this.cdr.detectChanges(); },
      error: () => { this.pendientes = []; this.cdr.detectChanges(); }
    });

    this.compras.compras().subscribe({
      next: (x: any) => { this.comprasCerradas = x || []; this.cdr.detectChanges(); },
      error: () => { this.comprasCerradas = []; this.cdr.detectChanges(); }
    });
  }

  procesarPendiente(row: any) {
    const idOrdenCompra = row.idOrdenCompra || row.IdOrdenCompra;
    this.compras.orden(idOrdenCompra).subscribe({
      next: (x: any) => {
        this.detalleCompra = null;
        this.detalleOc = x;
        const oc = x?.ordenCompra || x?.head || {};

        this.form = {
          numeroCompra: '',
          idOrdenCompra: oc?.idOrdenCompra ?? oc?.IdOrdenCompra ?? null,
          idProveedor: oc?.idProveedor ?? oc?.IdProveedor ?? null,
          fechaCompra: ''
        };

        this.itemPrecios = ((x?.items || []) as any[]).map((it: any) => ({
          idMaterial: Number(it.idMaterial || it.IdMaterial || 0),
          especialidad:
            it.especialidad ||
            it.Especialidad ||
            oc?.especialidad ||
            row?.especialidad ||
            row?.Especialidad ||
            '-',
          material: it.material || it.Material || '-',
          unidadMedida: it.unidadMedida || it.UnidadMedida || '-',
          cantidad: Number(it.cantidad || it.Cantidad || 0),
          idProveedor: Number(it.idProveedor || it.IdProveedor || oc?.idProveedor || 0) || null,
          proveedor:
            it.proveedor ||
            it.Proveedor ||
            oc?.proveedor ||
            row?.proveedor ||
            row?.Proveedor ||
            '-',
          precioUnitario: Number(it.precioUnitario || it.PrecioUnitario || 0),
          incluyeIgv: true,
          subtotalSinIgv: 0,
          montoIgv: 0,
          total: Number(it.subtotal || it.Subtotal || 0),
          observacion: '',
          files: []
        }));

        this.itemPrecios.forEach(x => this.recalcularItem(x));
        this.filtrosTabla = { especialidad: 'TODAS', proveedor: 'TODOS' };
        this.msg = 'OC cargada para continuar el flujo de compra.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.detalleOc = null;
        this.itemPrecios = [];
        this.msg = 'No se pudo cargar la OC pendiente.';
        this.cdr.detectChanges();
      }
    });
  }

  verCompra(row: any) {
    const idCompra = row.idCompra || row.IdCompra;
    this.compras.compra(idCompra).subscribe({
      next: (x: any) => {
        this.detalleOc = null;
        this.detalleCompra = x;
        this.documentos = x?.documentos || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.detalleCompra = null;
        this.msg = 'No se pudo cargar la compra.';
        this.cdr.detectChanges();
      }
    });
  }

  splitEspecialidades(value: string | null | undefined): string[] {
    return String(value || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);
  }

  get especialidadesDisponibles(): string[] {
    const vals = this.itemPrecios.flatMap(x => this.splitEspecialidades(x.especialidad));
    return Array.from(new Set(vals));
  }

  get proveedoresDisponibles(): string[] {
    const vals = this.itemPrecios.map(x => x.proveedor).filter(Boolean);
    return Array.from(new Set(vals));
  }

  get itemsFiltrados(): PrecioItem[] {
    return this.itemPrecios.filter(x => {
      const especialidadesItem = this.splitEspecialidades(x.especialidad);

      const okEspecialidad =
        this.filtrosTabla.especialidad === 'TODAS' ||
        especialidadesItem.includes(this.filtrosTabla.especialidad);

      const okProveedor =
        this.filtrosTabla.proveedor === 'TODOS' ||
        x.proveedor === this.filtrosTabla.proveedor;

      return okEspecialidad && okProveedor;
    });
  }

  mostrarEspecialidad(item: PrecioItem): string {
    if (this.filtrosTabla.especialidad !== 'TODAS') {
      return this.filtrosTabla.especialidad;
    }
    return this.splitEspecialidades(item.especialidad).join(', ');
  }

  abrirPrecioPorItem(item: PrecioItem) {
    const index = this.itemPrecios.findIndex(
      x =>
        x.idMaterial === item.idMaterial &&
        x.proveedor === item.proveedor &&
        x.material === item.material
    );
    if (index < 0) return;
    this.abrirPrecio(index);
  }

  abrirPrecio(index: number) {
    const item = this.itemPrecios[index];
    this.modalIndex = index;
    this.modalItem = {
      ...item,
      files: [...(item.files || [])]
    };
    this.modalOpen = true;
    if (this.modalFilesInput?.nativeElement) {
      this.modalFilesInput.nativeElement.value = '';
    }
  }

  cerrarModal() {
    this.modalOpen = false;
    this.modalIndex = -1;
    this.modalItem = null;
    if (this.modalFilesInput?.nativeElement) {
      this.modalFilesInput.nativeElement.value = '';
    }
  }

  onModalPrecioChange() {
    if (!this.modalItem) return;
    const cantidad = Number(this.modalItem.cantidad || 0);
    const precio = Number(this.modalItem.precioUnitario || 0);
    this.modalItem.total = this.round(cantidad * precio);
    this.recalcularItem(this.modalItem);
  }

  onModalTotalChange() {
    if (!this.modalItem) return;
    const cantidad = Number(this.modalItem.cantidad || 0);
    const total = Number(this.modalItem.total || 0);
    this.modalItem.precioUnitario = cantidad > 0 ? this.round(total / cantidad) : 0;
    this.recalcularItem(this.modalItem);
  }

  onModalIncluyeIgvChange() {
    if (!this.modalItem) return;
    this.recalcularItem(this.modalItem);
  }

  onModalFilesSelected(event: any) {
    if (!this.modalItem) return;
    const files = Array.from(event?.target?.files || []) as File[];
    this.modalItem.files = files.filter((f: File) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
  }

  guardarPrecioItem() {
    if (!this.modalItem || this.modalIndex < 0) return;
    this.recalcularItem(this.modalItem);
    this.itemPrecios[this.modalIndex] = { ...this.modalItem };
    this.cerrarModal();
    this.msg = 'Precio cargado correctamente para el ítem.';
  }

  get subtotalGeneral(): number {
    return this.round(
      this.itemPrecios.reduce((acc, x) => acc + Number(x.subtotalSinIgv || 0), 0)
    );
  }

  get igvGeneral(): number {
    return this.round(
      this.itemPrecios.reduce((acc, x) => acc + Number(x.montoIgv || 0), 0)
    );
  }

  get totalGeneral(): number {
    return this.round(
      this.itemPrecios.reduce((acc, x) => acc + Number(x.total || 0), 0)
    );
  }

  registrarCompra() {
    if (!this.form.idOrdenCompra) {
      this.msg = 'Debes seleccionar una OC pendiente.';
      return;
    }
    if (!(this.form.numeroCompra || '').trim()) {
      this.msg = 'Debes ingresar el número de compra.';
      return;
    }
    if (!(this.form.fechaCompra || '').trim()) {
      this.msg = 'Debes ingresar la fecha de compra.';
      return;
    }
    if (!this.itemPrecios.length) {
      this.msg = 'No hay ítems para registrar.';
      return;
    }
    if (this.itemPrecios.some(x => !Number(x.total || 0) || !Number(x.precioUnitario || 0))) {
      this.msg = 'Debes colocar precio a todos los ítems.';
      return;
    }

    const primerProveedor =
      this.itemPrecios.find(x => x.idProveedor)?.idProveedor || this.form.idProveedor || 0;

    const dto = {
      numeroCompra: (this.form.numeroCompra || '').trim(),
      idOrdenCompra: Number(this.form.idOrdenCompra),
      idProveedor: Number(primerProveedor),
      fechaCompra: this.form.fechaCompra,
      incluyeIGV: this.itemPrecios.some(x => x.incluyeIgv),
      subtotalSinIGV: this.subtotalGeneral,
      montoIGV: this.igvGeneral,
      montoTotal: this.totalGeneral,
      observacion: this.itemPrecios.map(x => x.observacion).filter(Boolean).join(' | '),
      items: this.itemPrecios.map(x => ({
        idMaterial: Number(x.idMaterial),
        cantidad: Number(x.cantidad),
        precioUnitario: Number(x.precioUnitario || 0)
      }))
    };

    const allFiles = this.itemPrecios.flatMap(x => x.files || []);
    if (!allFiles.length) {
      this.msg = 'Debes adjuntar al menos un PDF en uno de los ítems.';
      return;
    }

    this.compras.registrarCompra(dto).subscribe({
      next: (res: any) => {
        const idCompra = res?.idCompra || res?.IdCompra;
        if (!idCompra) {
          this.msg = 'La compra se registró, pero no se obtuvo el identificador.';
          this.load();
          return;
        }

        this.compras.uploadDocumentosCompra(idCompra, allFiles).subscribe({
          next: () => {
            this.msg = 'Compra registrada y documentos subidos correctamente.';
            this.resetForm();
            this.load();
          },
          error: (e: any) => {
            this.msg =
              e?.error?.message ||
              'La compra se registró, pero falló la subida de documentos.';
            this.resetForm();
            this.load();
          }
        });
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo registrar la compra.';
        this.cdr.detectChanges();
      }
    });
  }

  downloadDocumento(doc: any, compra: any) {
    const idCompra = compra?.compra?.idCompra || compra?.compra?.IdCompra;
    const docId = doc?.idCompraDocumento || doc?.IdCompraDocumento;
    if (!idCompra || !docId) return;
    window.open(this.compras.documentoCompraDownloadUrl(Number(idCompra), Number(docId)), '_blank');
  }

  resetForm() {
    this.detalleOc = null;
    this.detalleCompra = null;
    this.documentos = [];
    this.itemPrecios = [];
    this.filtrosTabla = { especialidad: 'TODAS', proveedor: 'TODOS' };
    this.form = {
      numeroCompra: '',
      idOrdenCompra: null,
      idProveedor: null,
      fechaCompra: ''
    };
    this.cerrarModal();
  }

  private recalcularItem(item: PrecioItem) {
    const total = Number(item.total || 0);
    if (item.incluyeIgv) {
      item.subtotalSinIgv = this.round(total / 1.18);
      item.montoIgv = this.round(total - item.subtotalSinIgv);
    } else {
      item.subtotalSinIgv = 0;
      item.montoIgv = 0;
    }
  }

  private round(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }
}