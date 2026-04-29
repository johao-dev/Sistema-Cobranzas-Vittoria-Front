import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
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
    cotizacionGeneral: null,
    activo: true
  };

  msg = '';
  saving = false;

  constructor(
    private maestra: MaestraService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(this.maestra.proyectos());
      this.rows = (data ?? []).map((row: any) => ({
        ...row,
        cotizacionGeneral: this.toNumber(row?.cotizacionGeneral ?? row?.CotizacionGeneral)
      }));
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
      cotizacionGeneral: this.toNumber(row?.cotizacionGeneral ?? row?.CotizacionGeneral),
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
      cotizacionGeneral: this.toNumber(this.form.cotizacionGeneral),
      activo: !!this.form.activo
    };

    this.saving = true;
    this.cdr.detectChanges();

    try {
      const res = await firstValueFrom(this.maestra.guardarProyecto(dto));

      this.msg = isEdit
        ? `Proyecto editado correctamente. ID: ${res?.idProyecto ?? this.form.idProyecto ?? ''}`
        : `Proyecto guardado correctamente. ID: ${res?.idProyecto ?? ''}`;

      this.notifyService.show(this.msg, 'success');
      this.reset(false);
      await this.load();
    } catch (e: any) {
      this.msg = e?.error?.message || 'No se pudo guardar el proyecto.';
      this.notifyService.show(this.msg, 'error');
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
      cotizacionGeneral: null,
      activo: true
    };

    if (clearMessage) {
      this.msg = '';
    }

    this.cdr.detectChanges();
  }

  formatMoney(value: any): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(this.toNumber(value));
  }

  private toNumber(value: any): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
  }
}
