import {
  itemVacio,
  cambiosItemRequerimiento,
  getIdEspecialidad,
  getNombreEspecialidad,
  getIdMaterial,
  getDescripcionMaterial,
  getUnidadMaterial,
} from './datos-item-requerimiento';
import { PartidasRequerimiento } from '../partidas-requerimiento';
import { DatosItemRequerimiento, ItemRequerimiento } from '../contratos-formulario-requerimiento';
import type { MaterialSeleccionado } from '../contratos-formulario-requerimiento';
import {
  CentroCostoResumen,
  SaldoPartida,
} from '../../app/models/consultas-presupuestarias.models';
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RequerimientoItemPatchRequest } from '../contratos-requerimientos';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { ReferenciasRequerimiento } from '../referencias-requerimiento/referencias-requerimiento';
import { BorradorRequerimiento } from '../borrador-requerimiento/borrador-requerimiento';

@Injectable()
export class EdicionItemRequerimiento {
  private readonly borrador = inject(BorradorRequerimiento);
  private readonly referencias = inject(ReferenciasRequerimiento);
  readonly presupuesto = inject(PartidasRequerimiento);
  private readonly destroyRef = inject(DestroyRef);

  readonly modalEspecialidades = signal(false);
  readonly modalItem = signal<DatosItemRequerimiento>(itemVacio());
  readonly editingItemIndex = signal<number | null>(null);

  private itemOriginal: ItemRequerimiento | null = null;
  private partidaAutoAsignada: number | null = null;

  readonly avisoPartidaMaterial = signal('');
  readonly materialFormOpen = signal(false);
  readonly savingMaterial = signal(false);

  readonly getIdEspecialidad = getIdEspecialidad;
  readonly getNombreEspecialidad = getNombreEspecialidad;
  readonly getIdMaterial = getIdMaterial;
  readonly getDescripcionMaterial = getDescripcionMaterial;
  readonly getUnidadMaterial = getUnidadMaterial;

  constructor() {
    this.presupuesto.actualizadas.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const material = this.referencias
        .materiales()
        .find((material) => material.idMaterial === this.modalItem().idMaterial);

      if (
        material &&
        this.modalEspecialidades() &&
        !this.itemOriginal &&
        this.modalItem().idPresupuestoDetalle === null
      )
        this.aplicarPartidaDelMaterial(material);
    });
  }

  get materialesFiltradosModal(): Material[] {
    if (!this.modalItem().idEspecialidad) return [];

    return (this.referencias.materiales() || []).filter(
      (m) => Number(this.getIdEspecialidad(m)) === Number(this.modalItem().idEspecialidad),
    );
  }

  onModalMaterialChange(): void {
    this.avisoPartidaMaterial.set('');

    if (
      this.partidaAutoAsignada !== null &&
      this.modalItem().idPresupuestoDetalle === this.partidaAutoAsignada
    ) {
      this.modalItem.update((valor) => ({ ...valor, idPresupuestoDetalle: null }));
    }

    this.partidaAutoAsignada = null;

    const material = (this.referencias.materiales() || []).find(
      (m) => Number(this.getIdMaterial(m)) === Number(this.modalItem().idMaterial),
    );

    if (!material) return;

    this.aplicarPartidaDelMaterial(material);
  }

  private aplicarPartidaDelMaterial(material: Material): void {
    const idPartida = Number(material.idCatalogoPartida ?? 0);

    if (!idPartida) {
      this.avisoPartidaMaterial.set(
        'Este material no tiene partida por defecto: elígela manualmente.',
      );
      return;
    }

    const etiqueta = material?.codigoPartida
      ? `${material.codigoPartida} — ${material.nombrePartida ?? ''}`.trim()
      : 'del material';

    if (!this.borrador.form()?.idProyecto) {
      this.avisoPartidaMaterial.set(`Selecciona el proyecto para asignar la partida ${etiqueta}.`);
      return;
    }

    const coincidencias = (this.presupuesto.partidas() || []).filter(
      (p) => Number(p.idCatalogoPartida) === idPartida,
    );

    if (coincidencias.length === 1) {
      this.modalItem.update((valor) => ({
        ...valor,
        idPresupuestoDetalle: coincidencias[0].idPresupuestoDetalle,
      }));

      this.partidaAutoAsignada = coincidencias[0].idPresupuestoDetalle;
    } else if (coincidencias.length > 1) {
      this.avisoPartidaMaterial.set(
        `La partida ${etiqueta} está en más de un presupuesto aprobado del proyecto: elige cuál.`,
      );
    } else {
      this.avisoPartidaMaterial.set(
        `La partida ${etiqueta} no está en el presupuesto aprobado del proyecto: elige otra partida.`,
      );
    }
  }

  get centroCostoDelProyecto(): CentroCostoResumen | null {
    const idProyecto = this.borrador.form()?.idProyecto;

    if (!idProyecto) return null;

    return (
      (this.presupuesto.centros() || []).find((c) => Number(c.idProyecto) === Number(idProyecto)) ??
      null
    );
  }

  get proyectoSinCentroCosto(): boolean {
    return (
      !!this.borrador.form().idProyecto &&
      !this.presupuesto.cargandoCentros() &&
      !this.presupuesto.errorCentros() &&
      !this.centroCostoDelProyecto
    );
  }

  onProyectoChange(): void {
    // Las partidas dependen del proyecto: al cambiarlo, la imputación anterior deja de ser válida.
    this.borrador.form.update((form) => ({
      ...form,
      items: form.items.map((item) => ({
        ...item,
        idPresupuestoDetalle: null,
        codigoPartida: null,
        nombrePartida: null,
      })),
    }));
    this.modalItem.update((item) => ({ ...item, idPresupuestoDetalle: null }));

    this.partidaAutoAsignada = null;

    this.cargarPartidasPresupuesto();
  }

  cargarPartidasPresupuesto(): void {
    this.presupuesto.cargar(this.borrador.form().idProyecto);
  }

  partidaPorDetalle(idPresupuestoDetalle: number | null | undefined): SaldoPartida | null {
    if (idPresupuestoDetalle === null || idPresupuestoDetalle === undefined) return null;

    return (
      (this.presupuesto.partidas() || []).find(
        (p) => Number(p.idPresupuestoDetalle) === Number(idPresupuestoDetalle),
      ) ?? null
    );
  }

  etiquetaPartida(item: ItemRequerimiento): string {
    if (!item?.idPresupuestoDetalle) return 'Sin imputar';

    if (item.codigoPartida) return `${item.codigoPartida} — ${item.nombrePartida ?? ''}`.trim();

    const partida = this.partidaPorDetalle(item.idPresupuestoDetalle);

    return partida ? `${partida.codigoPartida} — ${partida.partida}` : 'Partida no disponible';
  }

  get partidaSeleccionadaModal(): SaldoPartida | null {
    return this.partidaPorDetalle(this.modalItem().idPresupuestoDetalle);
  }

  abrirModalEspecialidades(index?: number): void {
    if (this.borrador.saving() || this.savingMaterial()) return;

    if (index !== undefined && !this.borrador.form().items[index]) return;

    this.itemOriginal = index !== undefined ? { ...this.borrador.form().items[index] } : null;

    this.borrador.msg.set('');
    this.avisoPartidaMaterial.set('');

    this.partidaAutoAsignada = null;

    this.modalEspecialidades.set(true);

    if (index !== undefined && index !== null && index >= 0) {
      const item = this.borrador.form().items[index];

      this.editingItemIndex.set(index);
      this.modalItem.set({
        idEspecialidad: item?.idEspecialidad ?? null,
        idMaterial: item?.idMaterial ?? null,
        idPresupuestoDetalle: item?.idPresupuestoDetalle ?? null,
        cantidad: Number(item?.cantidad ?? 1),
        observacion: item?.observacion ?? '',
      });
      return;
    }

    this.editingItemIndex.set(null);
    this.modalItem.set({
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: '',
    });
  }

  cerrarModalEspecialidades(descartar = false): boolean {
    if (this.savingMaterial()) return false;

    if (
      this.borrador.gestionItemsAlmacen() &&
      !descartar &&
      this.hayCambiosItemAlmacen &&
      !confirm('¿Descartar los cambios sin guardar de este ítem?')
    )
      return false;

    this.itemOriginal = null;

    this.avisoPartidaMaterial.set('');

    this.partidaAutoAsignada = null;

    this.modalEspecialidades.set(false);
    this.materialFormOpen.set(false);
    this.editingItemIndex.set(null);
    this.modalItem.set({
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: '',
    });
    return true;
  }

  onModalEspecialidadChange(): void {
    this.modalItem.update((valor) => ({ ...valor, idMaterial: null }));
    this.avisoPartidaMaterial.set('');

    if (
      this.partidaAutoAsignada !== null &&
      this.modalItem().idPresupuestoDetalle === this.partidaAutoAsignada
    ) {
      this.modalItem.update((valor) => ({ ...valor, idPresupuestoDetalle: null }));
    }

    this.partidaAutoAsignada = null;
  }

  abrirFormNuevoMaterial(): void {
    if (this.borrador.gestionItemsAlmacen()) return;

    this.materialFormOpen.set(true);
  }

  cerrarFormNuevoMaterial(): void {
    if (!this.savingMaterial()) this.materialFormOpen.set(false);
  }

  seleccionarMaterialCreado(evento: MaterialSeleccionado): void {
    this.referencias.materiales.set(evento.materiales);
    this.modalItem.update((item) => ({
      ...item,
      idEspecialidad: evento.idEspecialidad,
      idMaterial: evento.idMaterial,
    }));

    this.onModalMaterialChange();
  }

  agregarItemDesdeModal(): void {
    this.borrador.msg.set('');

    if (!this.modalItem().idEspecialidad) {
      this.borrador.msg.set('Debes seleccionar una especialidad.');
      return;
    }

    if (!this.modalItem().idMaterial) {
      this.borrador.msg.set('Debes seleccionar un material.');
      return;
    }

    if (!this.modalItem().cantidad || Number(this.modalItem().cantidad) <= 0) {
      this.borrador.msg.set('La cantidad debe ser mayor a 0.');
      return;
    }

    const material = this.referencias
      .materiales()
      .find((m) => Number(this.getIdMaterial(m)) === Number(this.modalItem().idMaterial));
    const especialidad = this.referencias
      .especialidades()
      .find((e) => Number(this.getIdEspecialidad(e)) === Number(this.modalItem().idEspecialidad));

    const nuevoItem = {
      idMaterial: Number(this.modalItem().idMaterial),
      idEspecialidad: Number(this.modalItem().idEspecialidad),
      especialidad:
        this.getNombreEspecialidad(material) || this.getNombreEspecialidad(especialidad) || '',
      material: this.getDescripcionMaterial(material),
      unidadMedida: this.getUnidadMaterial(material),
      cantidad: Number(this.modalItem().cantidad),
      observacion: this.modalItem().observacion ?? '',
      idPresupuestoDetalle: this.modalItem().idPresupuestoDetalle ?? null,
      codigoPartida: this.partidaSeleccionadaModal?.codigoPartida ?? null,
      nombrePartida: this.partidaSeleccionadaModal?.partida ?? null,
    };

    const index = this.editingItemIndex();

    if (index !== null && index >= 0) {
      this.borrador.form.update((form) => ({
        ...form,
        items: form.items.map((item, i) => (i === index ? nuevoItem : item)),
      }));
      this.borrador.msg.set('Ítem actualizado correctamente.');
    } else {
      this.borrador.form.update((form) => ({ ...form, items: [...form.items, nuevoItem] }));
      this.borrador.msg.set('Ítem agregado correctamente.');
    }

    this.cerrarModalEspecialidades();
  }

  removeItem(index: number): void {
    if (this.borrador.saving()) return;

    this.borrador.form.update((form) => ({
      ...form,
      items: form.items.filter((_, i) => i !== index),
    }));
  }

  get hayCambiosItemAlmacen(): boolean {
    if (!this.modalEspecialidades()) return false;

    if (this.itemOriginal) {
      return (
        this.modalItem().cantidad !== this.itemOriginal.cantidad ||
        Object.keys(this.cambiosItemAlmacen()).length > 0
      );
    }

    return (
      this.modalItem().idMaterial !== null ||
      this.modalItem().idEspecialidad !== null ||
      this.modalItem().cantidad !== 1 ||
      this.modalItem().idPresupuestoDetalle !== null ||
      this.modalItem().observacion !== ''
    );
  }

  cambiosItemAlmacen(): RequerimientoItemPatchRequest {
    return cambiosItemRequerimiento(this.itemOriginal, this.modalItem());
  }

  get original(): ItemRequerimiento | null {
    return this.itemOriginal;
  }

  reiniciar(): void {
    this.itemOriginal = null;
    this.partidaAutoAsignada = null;

    this.avisoPartidaMaterial.set('');
    this.modalEspecialidades.set(false);
    this.materialFormOpen.set(false);
    this.editingItemIndex.set(null);
    this.modalItem.set({
      idEspecialidad: null,
      idMaterial: null,
      idPresupuestoDetalle: null,
      cantidad: 1,
      observacion: '',
    });
  }
}
