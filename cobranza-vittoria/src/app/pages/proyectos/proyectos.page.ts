import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
import { MaestraService } from '../../core/services/maestra.service';
import { CotizacionMaterialesService } from '../../core/services/cotizacion-materiales.service';

@Component({
  standalone: true,
  selector: 'app-proyectos-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './proyectos.page.html',
  styleUrls: ['./proyectos.page.css']
})
export class ProyectosPage implements OnInit {
  modalOpen = false;

  abrirModalNuevo(): void {
    this.reset(false);
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

  especialidades: any[] = [];
  cotizacionItems: any[] = [];
  savingCotizaciones = false;
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
    private cotizacionMaterialesService: CotizacionMaterialesService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const [data, especialidades] = await Promise.all([
        firstValueFrom(this.maestra.proyectos()),
        firstValueFrom(this.maestra.especialidades(true))
      ]);
      this.especialidades = especialidades ?? [];
      this.sincronizarCotizacionesConEspecialidades();
      const baseRows = (data ?? []).map((row: any) => ({
        ...row,
        cotizacionGeneral: this.toNumber(row?.cotizacionGeneral ?? row?.CotizacionGeneral),
        cotizacionMateriales: this.toNumber(row?.cotizacionMateriales ?? row?.CotizacionMateriales)
      }));

      this.rows = await Promise.all(baseRows.map(async (row: any) => {
        const idProyecto = Number(row.idProyecto ?? row.IdProyecto ?? 0);
        if (!idProyecto) return row;

        try {
          const cotizacion = await firstValueFrom(this.cotizacionMaterialesService.getByProyecto(idProyecto));
          return {
            ...row,
            cotizacionMateriales: this.toNumber(cotizacion?.totalCotizacionMateriales ?? cotizacion?.TotalCotizacionMateriales)
          };
        } catch {
          return row;
        }
      }));
    } catch {
      this.rows = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  edit(row: any): void {
    this.modalOpen = true;
    this.form = {
      idProyecto: row.idProyecto,
      nombreProyecto: row.nombreProyecto ?? '',
      descripcion: row.descripcion ?? '',
      cotizacionGeneral: this.toNumber(row?.cotizacionGeneral ?? row?.CotizacionGeneral),
      activo: row.activo ?? true
    };
    this.msg = '';
    this.cargarCotizacionesMateriales(Number(row.idProyecto));
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
      const idProyectoGuardado = Number(res?.idProyecto ?? res?.IdProyecto ?? this.form.idProyecto ?? 0);
      if (idProyectoGuardado > 0) {
        await this.guardarCotizacionesMateriales(idProyectoGuardado);
      }

      this.msg = isEdit
        ? `Proyecto editado correctamente. ID: ${res?.idProyecto ?? this.form.idProyecto ?? ''}`
        : `Proyecto guardado correctamente. ID: ${res?.idProyecto ?? ''}`;

      this.notifyService.show(this.msg, 'success');
      this.reset(false);
      this.cerrarModal();
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
    this.sincronizarCotizacionesConEspecialidades();

    if (clearMessage) {
      this.msg = '';
    }

    this.cdr.detectChanges();
  }


  private sincronizarCotizacionesConEspecialidades(): void {
    const prev = new Map<number, number>();
    for (const item of this.cotizacionItems || []) {
      prev.set(Number(item.idEspecialidad), this.toNumber(item.cotizacion));
    }
    this.cotizacionItems = (this.especialidades || []).map((esp: any) => ({
      idEspecialidad: Number(esp.idEspecialidad ?? esp.IdEspecialidad),
      especialidad: String(esp.nombre ?? esp.Nombre ?? ''),
      cotizacion: prev.get(Number(esp.idEspecialidad ?? esp.IdEspecialidad)) ?? 0
    }));
  }

  totalCotizacionMateriales(): number {
    return this.cotizacionItems.reduce((acc, item) => acc + this.toNumber(item.cotizacion), 0);
  }

  cargarCotizacionesMateriales(idProyecto: number): void {
    this.sincronizarCotizacionesConEspecialidades();
    if (!idProyecto) return;
    this.cotizacionMaterialesService.getByProyecto(idProyecto).subscribe({
      next: (res: any) => {
        const apiItems = Array.isArray(res?.items) ? res.items : [];
        const map = new Map<number, number>();
        for (const item of apiItems) {
          map.set(Number(item.idEspecialidad ?? item.IdEspecialidad), this.toNumber(item.cotizacion ?? item.Cotizacion));
        }
        this.cotizacionItems = (this.especialidades || []).map((esp: any) => {
          const idEspecialidad = Number(esp.idEspecialidad ?? esp.IdEspecialidad);
          return {
            idEspecialidad,
            especialidad: String(esp.nombre ?? esp.Nombre ?? ''),
            cotizacion: map.get(idEspecialidad) ?? 0
          };
        });
        this.cdr.detectChanges();
      },
      error: () => {
        this.sincronizarCotizacionesConEspecialidades();
        this.cdr.detectChanges();
      }
    });
  }

  async guardarCotizacionesMateriales(idProyecto: number): Promise<void> {
    const items = (this.cotizacionItems || []).map(item => ({
      idEspecialidad: Number(item.idEspecialidad),
      cotizacion: this.toNumber(item.cotizacion)
    }));
    await firstValueFrom(this.cotizacionMaterialesService.guardar({ idProyecto, items }));
  }

  onAccion(event: Event, row: any): void {
    const value = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (value === 'edit') this.edit(row);
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
