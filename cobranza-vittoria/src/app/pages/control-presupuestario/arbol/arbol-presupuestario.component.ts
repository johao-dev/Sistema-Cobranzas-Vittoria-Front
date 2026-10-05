import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  ArbolPresupuestario,
  ControlPresupuestarioService,
  NodoArbol
} from '../../../core/services/control-presupuestario.service';

/** Fila visible del árbol: el nodo y su profundidad relativa a la raíz mostrada. */
interface FilaArbol {
  nodo: NodoArbol;
  profundidad: number;
  tieneHijos: boolean;
}

/**
 * Árbol de partidas con subtotales, tipo tabla dinámica.
 *
 * - modo 'vigente': seguimiento de un centro de costo (presupuestos activos con versión aprobada).
 * - modo 'version': una versión concreta en cualquier estado (p. ej. un borrador recién importado).
 *
 * El backend manda todos los nodos en una lista plana en preorden; aquí se arma el árbol por
 * idPartidaPadre y se expande en el cliente. Los montos de cada padre ya vienen sumados.
 */
@Component({
  standalone: true,
  selector: 'app-arbol-presupuestario',
  imports: [CommonModule, FormsModule],
  templateUrl: './arbol-presupuestario.component.html',
  styleUrl: './arbol-presupuestario.component.css'
})
export class ArbolPresupuestarioComponent implements OnChanges {
  @Input() modo: 'vigente' | 'version' = 'vigente';
  @Input() idCentroCosto: number | null = null;
  @Input() idPresupuesto: number | null = null;
  @Input() idVersion: number | null = null;
  /** Cambiar este valor fuerza a recargar el árbol (p. ej. tras una importación). */
  @Input() recarga = 0;
  /** Nivel impuesto desde fuera (el selector del panel); fija el "nivel máximo visible". */
  @Input() nivelSincronizado: number | null = null;
  /** Clic en una hoja: el contenedor abre sus movimientos. */
  @Output() abrirHoja = new EventEmitter<NodoArbol>();

  datos: ArbolPresupuestario | null = null;
  cargando = false;
  error = '';

  busqueda = '';
  soloDesviacion = false;
  nivelMaximo = '';

  filas: FilaArbol[] = [];
  seleccionado: NodoArbol | null = null;
  nivelesDisponibles: number[] = [];

  private expandidos = new Set<number>();
  private porId = new Map<number, NodoArbol>();
  private hijos = new Map<number | null, NodoArbol[]>();
  private raices: NodoArbol[] = [];

  constructor(private cp: ControlPresupuestarioService, private cdr: ChangeDetectorRef) { }

  ngOnChanges(changes: SimpleChanges): void {
    const soloNivel = Object.keys(changes).every(k => k === 'nivelSincronizado');
    if (soloNivel && !changes['nivelSincronizado'].firstChange) {
      this.aplicarNivelSincronizado();
      this.recalcular();
      return;
    }
    this.cargar();
  }

  private aplicarNivelSincronizado(): void {
    this.nivelMaximo = this.nivelSincronizado ? String(this.nivelSincronizado) : '';
  }

  get simbolo(): string {
    return this.datos?.encabezado?.simboloMoneda ?? '';
  }

  get hayFiltro(): boolean {
    return !!this.busqueda.trim() || this.soloDesviacion;
  }

  /** Cadena de ancestros del nodo seleccionado, de la raíz al nodo. */
  get ruta(): NodoArbol[] {
    const ruta: NodoArbol[] = [];
    let actual = this.seleccionado;
    while (actual) {
      ruta.unshift(actual);
      actual = actual.idPartidaPadre != null ? this.porId.get(actual.idPartidaPadre) ?? null : null;
    }
    return ruta;
  }

  // -------------------------------------------------------------------- carga

  cargar(): void {
    const peticion = this.peticion();
    if (!peticion) {
      this.datos = null;
      this.indexar();
      return;
    }
    this.cargando = true;
    this.error = '';
    peticion.subscribe({
      next: datos => {
        this.datos = datos;
        this.cargando = false;
        this.indexar();
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargando = false;
        this.datos = null;
        this.indexar();
        this.error = err?.error?.error === 'MONEDAS_MIXTAS'
          ? 'Los presupuestos de este centro de costo usan monedas distintas. Elige un presupuesto para ver su árbol.'
          : err?.error?.message || 'No se pudo cargar el árbol de partidas.';
        this.cdr.detectChanges();
      }
    });
  }

  private peticion(): Observable<ArbolPresupuestario> | null {
    if (this.modo === 'version') {
      return this.idPresupuesto && this.idVersion ? this.cp.arbolVersion(this.idPresupuesto, this.idVersion) : null;
    }
    return this.idCentroCosto ? this.cp.arbolVigente(this.idCentroCosto, this.idPresupuesto) : null;
  }

  /** Arma los índices padre → hijos conservando el preorden del backend. Empieza con solo las raíces. */
  private indexar(): void {
    this.porId.clear();
    this.hijos.clear();
    const nodos = this.datos?.nodos ?? [];
    nodos.forEach(n => this.porId.set(n.idCatalogoPartida, n));
    nodos.forEach(n => {
      // Un padre ausente de la respuesta se trata como raíz para no perder la rama.
      const padre = n.idPartidaPadre != null && this.porId.has(n.idPartidaPadre) ? n.idPartidaPadre : null;
      const lista = this.hijos.get(padre) ?? [];
      lista.push(n);
      this.hijos.set(padre, lista);
    });
    this.raices = this.hijos.get(null) ?? [];
    this.nivelesDisponibles = Array.from(new Set(nodos.map(n => Number(n.nivel)).filter(n => !isNaN(n))))
      .sort((a, b) => a - b);
    this.expandidos.clear();
    this.seleccionado = null;
    this.busqueda = '';
    this.soloDesviacion = false;
    this.aplicarNivelSincronizado();
    this.recalcular();
  }

  // ------------------------------------------------------------- expansión

  estaExpandido(nodo: NodoArbol): boolean {
    return this.expandidos.has(nodo.idCatalogoPartida);
  }

  alternar(nodo: NodoArbol): void {
    if (this.expandidos.has(nodo.idCatalogoPartida)) this.expandidos.delete(nodo.idCatalogoPartida);
    else this.expandidos.add(nodo.idCatalogoPartida);
    this.recalcular();
  }

  expandirTodo(): void {
    this.porId.forEach((n, id) => { if (this.hijos.has(id)) this.expandidos.add(id); });
    this.recalcular();
  }

  colapsarTodo(): void {
    this.expandidos.clear();
    this.recalcular();
  }

  onClicFila(fila: FilaArbol): void {
    this.seleccionado = fila.nodo;
    if (fila.tieneHijos) this.alternar(fila.nodo);
    else if (fila.nodo.esHoja) this.abrirHoja.emit(fila.nodo);
    else this.recalcular();
  }

  /** Breadcrumb: ir a un ancestro lo selecciona y deja visible su rama. */
  irA(nodo: NodoArbol | null): void {
    this.seleccionado = nodo;
    if (nodo) this.expandirAncestros(nodo, true);
    this.recalcular();
  }

  private expandirAncestros(nodo: NodoArbol, incluirNodo = false): void {
    let actual: NodoArbol | undefined = incluirNodo ? nodo
      : nodo.idPartidaPadre != null ? this.porId.get(nodo.idPartidaPadre) : undefined;
    while (actual) {
      this.expandidos.add(actual.idCatalogoPartida);
      actual = actual.idPartidaPadre != null ? this.porId.get(actual.idPartidaPadre) : undefined;
    }
  }

  // ---------------------------------------------------------------- filtros

  onBusqueda(): void {
    // La búsqueda abre los ancestros de las coincidencias; al limpiarla se vuelve a las raíces.
    this.expandidos.clear();
    const termino = this.normalizar(this.busqueda);
    if (termino) {
      this.porId.forEach(n => { if (this.coincideTexto(n, termino)) this.expandirAncestros(n); });
    }
    if (this.soloDesviacion) this.expandirDesviaciones();
    this.recalcular();
  }

  onSoloDesviacion(): void {
    if (this.soloDesviacion) this.expandirDesviaciones();
    this.recalcular();
  }

  onNivelMaximo(): void {
    this.recalcular();
  }

  private expandirDesviaciones(): void {
    this.porId.forEach(n => { if (this.tieneDesviacion(n) && this.hijos.has(n.idCatalogoPartida)) this.expandidos.add(n.idCatalogoPartida); });
  }

  private tieneDesviacion(n: NodoArbol): boolean {
    return !!n.excedido || Number(n.partidasExcedidas ?? 0) > 0;
  }

  private coincideTexto(n: NodoArbol, termino: string): boolean {
    return this.normalizar(`${n.codigo} ${n.nombre}`).includes(termino);
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  /**
   * Nodos que pasan los filtros: coincidencias, sus ancestros (para llegar a ellas) y, en la
   * búsqueda por texto, los descendientes de una categoría que coincide. Null = sin filtro.
   */
  private incluidos(): Set<number> | null {
    const termino = this.normalizar(this.busqueda);
    if (!termino && !this.soloDesviacion) return null;

    const pasa = (n: NodoArbol) => !this.soloDesviacion || this.tieneDesviacion(n);
    const incluidos = new Set<number>();
    const agregarDescendientes = (id: number) => {
      (this.hijos.get(id) ?? []).forEach(h => {
        if (!pasa(h)) return;
        incluidos.add(h.idCatalogoPartida);
        agregarDescendientes(h.idCatalogoPartida);
      });
    };

    this.porId.forEach(n => {
      if (!pasa(n) || (termino && !this.coincideTexto(n, termino))) return;
      let actual: NodoArbol | undefined = n;
      while (actual && !incluidos.has(actual.idCatalogoPartida)) {
        incluidos.add(actual.idCatalogoPartida);
        actual = actual.idPartidaPadre != null ? this.porId.get(actual.idPartidaPadre) : undefined;
      }
      if (termino) agregarDescendientes(n.idCatalogoPartida);
    });
    return incluidos;
  }

  /** Recorre el árbol en preorden y deja solo las filas visibles. */
  private recalcular(): void {
    const incluidos = this.incluidos();
    const nivelMax = this.nivelMaximo === '' ? Infinity : Number(this.nivelMaximo);
    const filas: FilaArbol[] = [];

    const visitar = (nodos: NodoArbol[], profundidad: number) => {
      for (const n of nodos) {
        if (incluidos && !incluidos.has(n.idCatalogoPartida)) continue;
        if (Number(n.nivel) > nivelMax) continue;
        const hijos = (this.hijos.get(n.idCatalogoPartida) ?? [])
          .filter(h => (!incluidos || incluidos.has(h.idCatalogoPartida)) && Number(h.nivel) <= nivelMax);
        filas.push({ nodo: n, profundidad, tieneHijos: hijos.length > 0 });
        if (hijos.length && this.expandidos.has(n.idCatalogoPartida)) visitar(hijos, profundidad + 1);
      }
    };
    visitar(this.raices, 0);
    this.filas = filas;
  }

  // ---------------------------------------------------------------- formato

  sangria(fila: FilaArbol): string {
    return `${fila.profundidad * 18}px`;
  }

  /** Semáforo del % ejecutado: verde hasta 80%, ámbar hasta 100%, rojo por encima. */
  claseBarra(valor: number): string {
    if (valor > 100) return 'barra__fill--danger';
    if (valor > 80) return 'barra__fill--warn';
    return 'barra__fill--ok';
  }

  anchoBarra(valor: number): string {
    return `${Math.max(0, Math.min(Number(valor) || 0, 100))}%`;
  }

  trackFila(_: number, fila: FilaArbol): number {
    return fila.nodo.idCatalogoPartida;
  }
}
