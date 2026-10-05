import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlPresupuestarioService, NodoArbol } from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';
import { descargarArchivo, extraerFilenameDeContentDisposition } from '../../core/utils/file-download.util';
import { ArbolPresupuestarioComponent } from '../control-presupuestario/arbol/arbol-presupuestario.component';

/** Fila editable del formulario de carga completa. */
interface FilaCarga {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  grupo: string;
  monto: number | null;
  observacion: string;
}

@Component({
  standalone: true,
  selector: 'app-presupuestos-page',
  imports: [CommonModule, FormsModule, ArbolPresupuestarioComponent],
  templateUrl: './presupuestos.page.html',
  styleUrl: './presupuestos.page.css'
})
export class PresupuestosPage implements OnInit {
  presupuestos: any[] = [];
  centrosCosto: any[] = [];
  monedas: any[] = [];
  partidas: any[] = [];

  versiones: any[] = [];
  detalles: any[] = [];
  movimientos: any[] = [];

  seleccionado: any = null;
  versionSeleccionada: any = null;
  detalleSeleccionado: any = null;

  loading = false;
  cargandoVersiones = false;
  cargandoDetalles = false;
  cargandoMovimientos = false;
  guardando = false;

  filtroActivo = 'true';
  filtroCentroCosto = '';
  filtroBusqueda = '';

  modalPresupuesto = false;
  modalVersion = false;
  modalAnular = false;
  motivoAnulacion = '';
  modalDetalle = false;
  modalMovimientos = false;
  modalAjuste = false;
  modalCarga = false;
  modalImportar = false;
  modalEstructura = false;
  /** Confirmación de inactivar un presupuesto con registros (409 PRESUPUESTO_CON_REGISTROS). */
  modalConfirmarInactivar = false;
  mensajeInactivar = '';

  /** Montos de la versión como lista plana o como árbol con subtotales. */
  vistaVersion: 'tabla' | 'arbol' = 'tabla';
  recargaArbol = 0;
  /** Resultado de la última importación de estructura, visible sobre el árbol. */
  resumenEstructura: any = null;

  // Carga completa: todas las partidas hoja activas con su monto.
  filasCarga: FilaCarga[] = [];
  busquedaCarga = '';

  // Importación CSV/XLSX.
  archivoImportar: File | null = null;
  quitarAusentesImportar = false;
  resultadoImportar: any = null;
  erroresImportar: any[] = [];
  mensajeErrorImportar = '';
  descargandoPlantilla = false;

  form: any = this.formVacio();
  formVersion: any = { descripcion: '', motivoCambio: '' };
  formDetalle: any = this.formDetalleVacio();
  formAjuste: any = this.formAjusteVacio();

  constructor(
    private cp: ControlPresupuestarioService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.load();
  }

  // ----------------------------------------------------------------- formularios

  formVacio() {
    return {
      idPresupuesto: null,
      idCentroCosto: '',
      idMoneda: '',
      codigo: '',
      nombre: '',
      descripcion: '',
      fechaInicio: '',
      fechaFin: '',
      activo: true
    };
  }

  formDetalleVacio() {
    return { idPresupuestoDetalle: null, idCatalogoPartida: '', montoPresupuestado: 0, observacion: '' };
  }

  formAjusteVacio() {
    return { afectacion: 'EJECUCION', direccion: 'DECREMENTO', monto: 0, observacion: '', fecha: '' };
  }

  get esEdicion(): boolean {
    return !!this.form.idPresupuesto;
  }

  get esEdicionDetalle(): boolean {
    return !!this.formDetalle.idPresupuestoDetalle;
  }

  /** Solo una versión en BORRADOR admite cambios de montos. */
  get versionEditable(): boolean {
    return (this.versionSeleccionada?.estado ?? '') === 'BORRADOR';
  }

  get versionAprobable(): boolean {
    return this.versionEditable && this.detalles.length > 0;
  }

  /** Las partidas agrupadoras no reciben monto; solo se presupuestan las hojas. */
  get partidasAsignables(): any[] {
    const yaAsignadas = new Set(this.detalles.map(d => d.idCatalogoPartida));
    return (this.partidas ?? []).filter(p =>
      p.activo && p.esHoja &&
      (p.idCatalogoPartida === this.formDetalle.idCatalogoPartida || !yaAsignadas.has(p.idCatalogoPartida)));
  }

  get totalPresupuestado(): number {
    return (this.detalles ?? []).reduce((acc, d) => acc + Number(d.montoPresupuestado ?? 0), 0);
  }

  get simbolo(): string {
    return this.seleccionado?.simboloMoneda || this.seleccionado?.moneda || '';
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get presupuestosFiltrados(): any[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.presupuestos ?? [];
    return (this.presupuestos ?? []).filter(row =>
      this.normalizar([row.codigo, row.nombre, row.centroCosto].join(' ')).includes(termino));
  }

  etiquetaEstado(estado: string): string {
    switch (estado) {
      case 'APROBADO': return 'Aprobado';
      case 'EN_ELABORACION': return 'En elaboración';
      case 'EN_REVISION': return 'En revisión';
      case 'SIN_VERSION_VIGENTE': return 'Sin versión vigente';
      case 'INCONSISTENTE': return 'Inconsistente';
      default: return estado || '—';
    }
  }

  // ------------------------------------------------------------------ carga base

  cargarCatalogos(): void {
    this.cp.catalogos().subscribe({
      next: data => {
        this.monedas = data?.monedas ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error')
    });

    this.cp.centrosCosto(true, null, null).subscribe({
      next: rows => {
        this.centrosCosto = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los centros de costo.', 'error')
    });

    this.cp.partidas({ activo: true, esHoja: true }).subscribe({
      next: rows => {
        this.partidas = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar las partidas.', 'error')
    });
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const centro = this.filtroCentroCosto === '' ? null : Number(this.filtroCentroCosto);

    this.cp.presupuestos(activo, centro, null, null).subscribe({
      next: rows => {
        this.presupuestos = rows ?? [];
        this.loading = false;
        if (this.seleccionado) {
          const vigente = this.presupuestos.find(p => p.idPresupuesto === this.seleccionado.idPresupuesto);
          this.seleccionado = vigente ?? null;
          if (!this.seleccionado) this.limpiarSeleccion();
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los presupuestos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  limpiarSeleccion(): void {
    this.seleccionado = null;
    this.versionSeleccionada = null;
    this.versiones = [];
    this.detalles = [];
  }

  seleccionar(row: any): void {
    this.seleccionado = row;
    this.versionSeleccionada = null;
    this.detalles = [];
    this.cargarVersiones();
  }

  // ------------------------------------------------------------------- versiones

  cargarVersiones(): void {
    if (!this.seleccionado) return;
    this.cargandoVersiones = true;

    this.cp.versiones(this.seleccionado.idPresupuesto).subscribe({
      next: rows => {
        this.versiones = rows ?? [];
        this.cargandoVersiones = false;
        // Prioriza el borrador en curso; si no hay, muestra la versión vigente.
        const preferida = this.versiones.find(v => v.estado === 'BORRADOR')
          ?? this.versiones.find(v => v.estado === 'APROBADO')
          ?? this.versiones[0];
        if (preferida) this.seleccionarVersion(preferida);
        else this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoVersiones = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar las versiones.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  seleccionarVersion(version: any): void {
    this.versionSeleccionada = version;
    this.resumenEstructura = null;
    this.cargarDetalles();
  }

  abrirModalVersion(): void {
    if (!this.seleccionado) return;
    this.formVersion = { descripcion: '', motivoCambio: '' };
    this.modalVersion = true;
    this.cdr.detectChanges();
  }

  crearVersion(): void {
    if (!this.seleccionado) return;
    if (!String(this.formVersion.motivoCambio ?? '').trim()) {
      this.notifications.show('Indica el motivo del cambio para dejar trazabilidad.', 'info');
      return;
    }

    this.guardando = true;
    this.cp.crearVersion(this.seleccionado.idPresupuesto, this.formVersion).subscribe({
      next: () => {
        this.guardando = false;
        this.modalVersion = false;
        this.notifications.show('Nueva versión creada en borrador.', 'success');
        this.cargarVersiones();
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo crear la versión.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  aprobarVersion(): void {
    if (!this.versionSeleccionada) return;
    const numero = this.versionSeleccionada.numeroVersion;
    if (!confirm(
      `¿Aprobar la versión ${numero}? A partir de la aprobación el presupuesto empieza a afectar saldos.`)) return;

    this.cp.aprobarVersion(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion).subscribe({
      next: () => {
        this.notifications.show(`Versión ${numero} aprobada.`, 'success');
        this.cargarVersiones();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo aprobar la versión.', 'error')
    });
  }

  /** Anular un borrador no se revierte y exige el motivo, que queda en la versión. */
  anularVersion(): void {
    if (!this.versionSeleccionada) return;
    this.motivoAnulacion = '';
    this.modalAnular = true;
    this.cdr.detectChanges();
  }

  confirmarAnulacion(): void {
    if (!this.seleccionado || !this.versionSeleccionada) return;
    const motivo = this.motivoAnulacion.trim();
    if (!motivo) {
      this.notifications.show('Indica el motivo de la anulación.', 'info');
      return;
    }
    const numero = this.versionSeleccionada.numeroVersion;
    this.guardando = true;
    this.cp.anularVersion(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion, motivo).subscribe({
      next: () => {
        this.guardando = false;
        this.modalAnular = false;
        this.notifications.show(`Versión ${numero} anulada.`, 'success');
        this.cargarVersiones();
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo anular la versión.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // -------------------------------------------------------------------- detalles

  cargarDetalles(): void {
    if (!this.versionSeleccionada) return;
    this.cargandoDetalles = true;

    this.cp.detalles(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion).subscribe({
      next: rows => {
        this.detalles = rows ?? [];
        this.cargandoDetalles = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoDetalles = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los montos por partida.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalDetalle(detalle?: any): void {
    if (!this.versionEditable) {
      this.notifications.show('Solo se pueden editar montos en una versión en borrador.', 'info');
      return;
    }
    this.formDetalle = detalle
      ? {
        idPresupuestoDetalle: detalle.idPresupuestoDetalle,
        idCatalogoPartida: detalle.idCatalogoPartida,
        montoPresupuestado: detalle.montoPresupuestado,
        observacion: detalle.observacion ?? ''
      }
      : this.formDetalleVacio();
    this.modalDetalle = true;
    this.cdr.detectChanges();
  }

  guardarDetalle(): void {
    if (!this.versionSeleccionada) return;
    if (!this.esEdicionDetalle && !this.formDetalle.idCatalogoPartida) {
      this.notifications.show('Selecciona la partida a presupuestar.', 'info');
      return;
    }
    const monto = Number(this.formDetalle.montoPresupuestado ?? 0);
    if (isNaN(monto) || monto < 0) {
      this.notifications.show('El monto presupuestado no puede ser negativo.', 'info');
      return;
    }

    this.guardando = true;
    const peticion = this.esEdicionDetalle
      ? this.cp.actualizarDetalle(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
        this.formDetalle.idPresupuestoDetalle, this.formDetalle)
      : this.cp.agregarDetalle(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion, this.formDetalle);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalDetalle = false;
        this.notifications.show('Monto guardado correctamente.', 'success');
        this.cargarDetalles();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo guardar el monto.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  eliminarDetalle(detalle: any): void {
    if (!this.versionEditable) {
      this.notifications.show('Solo se pueden quitar partidas en una versión en borrador.', 'info');
      return;
    }
    if (!confirm(`¿Quitar la partida ${detalle.codigo} de esta versión?`)) return;

    this.cp.eliminarDetalle(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
      detalle.idPresupuestoDetalle).subscribe({
      next: () => {
        this.notifications.show('Partida retirada de la versión.', 'success');
        this.cargarDetalles();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo quitar la partida.', 'error')
    });
  }

  // ----------------------------------------------------------------- movimientos

  verMovimientos(detalle: any): void {
    this.detalleSeleccionado = detalle;
    this.modalMovimientos = true;
    this.cargandoMovimientos = true;
    this.movimientos = [];

    this.cp.movimientos(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
      detalle.idPresupuestoDetalle).subscribe({
      next: rows => {
        this.movimientos = rows ?? [];
        this.cargandoMovimientos = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoMovimientos = false;
        this.notifications.show(err?.error?.message || 'No se pudo cargar el historial.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalAjuste(detalle: any): void {
    this.detalleSeleccionado = detalle;
    this.formAjuste = this.formAjusteVacio();
    this.modalAjuste = true;
    this.cdr.detectChanges();
  }

  registrarAjuste(): void {
    if (!this.detalleSeleccionado) return;
    const monto = Number(this.formAjuste.monto ?? 0);
    if (isNaN(monto) || monto <= 0) {
      this.notifications.show('El monto del ajuste debe ser mayor a cero.', 'info');
      return;
    }
    if (!String(this.formAjuste.observacion ?? '').trim()) {
      this.notifications.show('Un ajuste requiere una observación que lo justifique.', 'info');
      return;
    }

    this.guardando = true;
    this.cp.registrarAjuste(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
      this.detalleSeleccionado.idPresupuestoDetalle, this.formAjuste).subscribe({
      next: () => {
        this.guardando = false;
        this.modalAjuste = false;
        this.notifications.show('Ajuste registrado en el historial.', 'success');
        this.cargarDetalles();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo registrar el ajuste.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ---------------------------------------------------------------- presupuestos

  abrirModalNuevo(): void {
    this.form = this.formVacio();
    this.modalPresupuesto = true;
    this.cdr.detectChanges();
  }

  editarPresupuesto(row: any): void {
    this.form = {
      idPresupuesto: row.idPresupuesto,
      idCentroCosto: row.idCentroCosto,
      idMoneda: row.idMoneda,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      descripcion: row.descripcion ?? '',
      fechaInicio: this.soloFecha(row.fechaInicio),
      fechaFin: this.soloFecha(row.fechaFin),
      activo: row.activo ?? true
    };
    this.modalPresupuesto = true;
    this.cdr.detectChanges();
  }

  guardarPresupuesto(confirmarInactivacion = false): void {
    if (!this.esEdicion) {
      if (!this.form.idCentroCosto) {
        this.notifications.show('Selecciona el centro de costo.', 'info');
        return;
      }
      if (!this.form.idMoneda) {
        this.notifications.show('Selecciona la moneda del presupuesto.', 'info');
        return;
      }
      if (!String(this.form.codigo ?? '').trim()) {
        this.notifications.show('Ingresa el código del presupuesto.', 'info');
        return;
      }
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre del presupuesto.', 'info');
      return;
    }
    if (this.form.fechaInicio && this.form.fechaFin && this.form.fechaFin < this.form.fechaInicio) {
      this.notifications.show('La fecha fin no puede ser anterior a la fecha inicio.', 'info');
      return;
    }

    this.guardando = true;
    const peticion = this.esEdicion
      ? this.cp.actualizarPresupuesto(this.form.idPresupuesto, this.form, confirmarInactivacion)
      : this.cp.crearPresupuesto(this.form);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalPresupuesto = false;
        this.modalConfirmarInactivar = false;
        this.notifications.show('Presupuesto guardado correctamente.', 'success');
        this.load();
      },
      error: err => {
        this.guardando = false;
        // Con gastos, movimientos o requerimientos el backend pide confirmar la inactivación.
        if (err?.status === 409 && err?.error?.error === 'PRESUPUESTO_CON_REGISTROS' && !confirmarInactivacion) {
          this.mensajeInactivar = err.error.message || 'Este presupuesto tiene registros asociados. ¿Inactivarlo de todos modos?';
          this.modalConfirmarInactivar = true;
        } else {
          this.notifications.show(err?.error?.message || 'No se pudo guardar el presupuesto.', 'error');
        }
        this.cdr.detectChanges();
      }
    });
  }

  confirmarInactivacion(): void {
    this.guardarPresupuesto(true);
  }

  cancelarInactivacion(): void {
    if (this.guardando) return;
    this.modalConfirmarInactivar = false;
    this.cdr.detectChanges();
  }

  cerrarModales(): void {
    if (this.guardando) return;
    this.modalPresupuesto = false;
    this.modalVersion = false;
    this.modalAnular = false;
    this.modalDetalle = false;
    this.modalMovimientos = false;
    this.modalAjuste = false;
    this.modalCarga = false;
    this.modalImportar = false;
    this.modalEstructura = false;
    this.modalConfirmarInactivar = false;
    this.cdr.detectChanges();
  }

  // ------------------------------------------------------------ carga completa

  /**
   * Abre la grilla con todas las partidas hoja activas. Las que ya están en la
   * versión traen su monto; las demás empiezan en 0 ("si no aplica, se deja en 0").
   */
  abrirCargaCompleta(): void {
    if (!this.versionEditable) {
      this.notifications.show('Solo se pueden cargar montos en una versión en borrador.', 'info');
      return;
    }
    const actuales = new Map(this.detalles.map(d => [d.idCatalogoPartida, d]));
    this.filasCarga = (this.partidas ?? [])
      .filter(p => p.activo && p.esHoja)
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }))
      .map(p => {
        const d = actuales.get(p.idCatalogoPartida);
        return {
          idCatalogoPartida: p.idCatalogoPartida,
          codigo: p.codigo,
          nombre: p.nombre,
          grupo: p.codigoPartidaPadre ? `${p.codigoPartidaPadre} — ${p.nombrePartidaPadre}` : 'Sin partida padre',
          monto: d ? Number(d.montoPresupuestado) : 0,
          observacion: d?.observacion ?? ''
        };
      });
    this.busquedaCarga = '';
    this.modalCarga = true;
    this.cdr.detectChanges();
  }

  get filasCargaVisibles(): FilaCarga[] {
    const termino = this.normalizar(this.busquedaCarga);
    if (!termino) return this.filasCarga;
    return this.filasCarga.filter(f => this.normalizar(`${f.codigo} ${f.nombre} ${f.grupo}`).includes(termino));
  }

  /** Muestra el encabezado de grupo solo en la primera fila visible de cada padre. */
  iniciaGrupo(index: number): boolean {
    const visibles = this.filasCargaVisibles;
    return index === 0 || visibles[index].grupo !== visibles[index - 1].grupo;
  }

  get totalCarga(): number {
    return this.filasCarga.reduce((acc, f) => acc + (Number(f.monto) || 0), 0);
  }

  get partidasConMonto(): number {
    return this.filasCarga.filter(f => Number(f.monto) > 0).length;
  }

  guardarCargaCompleta(): void {
    if (!this.versionSeleccionada) return;
    const invalida = this.filasCarga.find(f =>
      f.monto === null || (f.monto as any) === '' || isNaN(Number(f.monto)) || Number(f.monto) < 0);
    if (invalida) {
      this.notifications.show(`Revisa el monto de la partida ${invalida.codigo}: debe ser 0 o mayor.`, 'info');
      return;
    }
    this.guardando = true;
    const lote = this.filasCarga.map(f => ({
      idCatalogoPartida: f.idCatalogoPartida,
      montoPresupuestado: Number(f.monto),
      observacion: f.observacion
    }));
    this.cp.cargarDetallesLote(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion, lote).subscribe({
      next: r => {
        this.guardando = false;
        this.modalCarga = false;
        this.notifications.show(
          `Montos guardados: ${r.agregados} partida(s) agregada(s) y ${r.actualizados} actualizada(s).`, 'success');
        this.cargarDetalles();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudieron guardar los montos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // --------------------------------------------------------------- importación

  abrirImportar(): void {
    if (!this.versionEditable) {
      this.notifications.show('Solo se pueden cargar montos en una versión en borrador.', 'info');
      return;
    }
    this.archivoImportar = null;
    this.quitarAusentesImportar = false;
    this.limpiarResultadoImportar();
    this.modalImportar = true;
    this.cdr.detectChanges();
  }

  private limpiarResultadoImportar(): void {
    this.resultadoImportar = null;
    this.erroresImportar = [];
    this.mensajeErrorImportar = '';
  }

  onArchivoImportar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.limpiarResultadoImportar();
    this.archivoImportar = null;
    if (file && !/\.(csv|xlsx|xls)$/i.test(file.name)) {
      this.notifications.show('Usa un archivo CSV, XLSX o XLS.', 'error');
      input.value = '';
    } else if (file && file.size > 5 * 1024 * 1024) {
      this.notifications.show('El archivo supera el tamaño máximo de 5 MB.', 'error');
      input.value = '';
    } else {
      this.archivoImportar = file;
    }
    this.cdr.detectChanges();
  }

  importar(): void {
    if (!this.versionSeleccionada || !this.archivoImportar) return;
    this.guardando = true;
    this.limpiarResultadoImportar();
    this.cp.importarPresupuesto(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
      this.archivoImportar,
      this.quitarAusentesImportar).subscribe({
      next: r => {
        this.guardando = false;
        this.resultadoImportar = r;
        this.notifications.show('Montos importados correctamente.', 'success');
        this.cargarDetalles();
      },
      error: err => {
        this.guardando = false;
        this.erroresImportar = Array.isArray(err?.error?.errores) ? err.error.errores : [];
        this.mensajeErrorImportar = err?.error?.message || 'No se pudo importar el archivo.';
        // Con errores por fila los muestra la tabla del modal; el aviso queda para el resto.
        if (!this.erroresImportar.length) this.notifications.show(this.mensajeErrorImportar, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  descargarPlantilla(formato: 'csv' | 'xlsx', tipo: 'montos' | 'estructura' = 'montos'): void {
    if (!this.versionSeleccionada || this.descargandoPlantilla) return;
    this.descargandoPlantilla = true;
    const idPresupuesto = this.seleccionado.idPresupuesto;
    const idVersion = this.versionSeleccionada.idPresupuestoVersion;
    const peticion = tipo === 'estructura'
      ? this.cp.plantillaEstructura(idPresupuesto, idVersion, formato)
      : this.cp.plantillaPresupuesto(idPresupuesto, idVersion, formato);
    peticion.subscribe({
      next: resp => {
        this.descargandoPlantilla = false;
        if (resp.body) {
          const nombre = extraerFilenameDeContentDisposition(resp.headers.get('Content-Disposition'),
            tipo === 'estructura' ? `plantilla-estructura.${formato}` : `plantilla-presupuesto.${formato}`);
          descargarArchivo(resp.body, nombre);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.descargandoPlantilla = false;
        this.notifications.show('No se pudo descargar la plantilla.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ------------------------------------------------- importación de estructura

  /** Excel jerárquico de las áreas: crea las partidas que falten y carga los montos de las hojas. */
  abrirImportarEstructura(): void {
    if (!this.versionEditable) {
      this.notifications.show('Solo se puede importar la estructura en una versión en borrador.', 'info');
      return;
    }
    this.archivoImportar = null;
    this.quitarAusentesImportar = false;
    this.limpiarResultadoImportar();
    this.modalEstructura = true;
    this.cdr.detectChanges();
  }

  importarEstructura(): void {
    if (!this.versionSeleccionada || !this.archivoImportar) return;
    this.guardando = true;
    this.limpiarResultadoImportar();
    this.cp.importarEstructura(this.seleccionado.idPresupuesto, this.versionSeleccionada.idPresupuestoVersion,
      this.archivoImportar, this.quitarAusentesImportar).subscribe({
      next: r => {
        this.guardando = false;
        this.modalEstructura = false;
        this.resumenEstructura = r;
        this.notifications.show(
          `Estructura importada: ${r?.partidasCreadas ?? 0} partida(s) nueva(s) en el catálogo.`, 'success');
        // Se abre el árbol de la versión para validar padres, hijas y subtotales.
        this.vistaVersion = 'arbol';
        this.recargaArbol++;
        this.cargarDetalles();
        this.recargarPartidas();
      },
      error: err => {
        this.guardando = false;
        this.erroresImportar = Array.isArray(err?.error?.errores) ? err.error.errores : [];
        this.mensajeErrorImportar = err?.error?.message || 'No se pudo importar el archivo.';
        if (!this.erroresImportar.length) this.notifications.show(this.mensajeErrorImportar, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  /** La importación de estructura puede crear partidas: se refresca el catálogo de hojas. */
  private recargarPartidas(): void {
    this.cp.partidas({ activo: true, esHoja: true }).subscribe({
      next: rows => {
        this.partidas = rows ?? [];
        this.cdr.detectChanges();
      }
    });
  }

  // ------------------------------------------------------------------- árbol

  cambiarVistaVersion(vista: 'tabla' | 'arbol'): void {
    this.vistaVersion = vista;
    this.cdr.detectChanges();
  }

  /** Hoja del árbol de la versión: se abre el historial de su detalle. */
  verMovimientosNodo(nodo: NodoArbol): void {
    const detalle = this.detalles.find(d =>
      (nodo.idPresupuestoDetalle && d.idPresupuestoDetalle === nodo.idPresupuestoDetalle)
      || d.idCatalogoPartida === nodo.idCatalogoPartida);
    if (!detalle) {
      this.notifications.show('No se encontró el detalle de esta partida en la versión.', 'info');
      return;
    }
    this.verMovimientos(detalle);
  }

  /** errores[].fila cuenta solo filas de datos; en la hoja de Excel se suma el encabezado. */
  filaExcel(fila: any): number | string {
    const n = Number(fila);
    return isNaN(n) ? (fila ?? '—') : n + 1;
  }

  private soloFecha(valor: any): string {
    if (!valor) return '';
    const texto = String(valor);
    return texto.length >= 10 ? texto.substring(0, 10) : texto;
  }
}
