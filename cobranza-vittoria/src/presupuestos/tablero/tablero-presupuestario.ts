import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import {
  OnDestroy,
  input,
  output,
  inject,
  ChangeDetectorRef,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
} from '@angular/core';
import { debounceTime, Subject, Subscription } from 'rxjs';
import {
  Tablero,
  TableroRubro,
  TableroRama,
  TableroPuntoSemana,
  TableroDesviacionRubro,
} from './contratos-tablero-presupuestario';
import { PartidaCatalogo } from '../partidas/contratos-partidas';
import { ConsultasPresupuestarias } from '../consultas/consultas-presupuestarias';
import { CommonModule } from '@angular/common';

/** Segmento de la dona: los 5 rubros con más gasto y el resto agrupado en "Otros". */
interface Segmento {
  nombre: string;
  monto: number;
  porcentaje: number;
  color: string;
  path: string;
  /** Rubro de origen; null en "Otros". */
  rubro: TableroRubro | null;
}

interface Punto {
  x: number;
  y: number;
}

/**
 * Dashboard presupuestario de un centro de costo.
 *
 * 1. Distribución del gasto por rubro: dona (5 rubros + "Otros", el máximo que
 *    se lee de un vistazo) y tabla con todos los rubros, que además es la vista
 *    accesible y el alivio de contraste de los colores claros.
 * 2. Evolución semanal del gasto real acumulado frente al presupuesto acumulado
 *    (un solo eje, misma unidad), con crosshair y tabla de datos.
 *
 * Colores: categórica validada con el script de la guía de visualización
 * (adyacentes CVD ΔE ≥ 9.1, visión normal ≥ 19.6). El texto nunca usa el color
 * de la serie; la identidad la lleva la marca de color al lado.
 */
@Component({
  standalone: true,
  selector: 'tablero-presupuestario',
  imports: [CommonModule],
  templateUrl: './tablero-presupuestario.html',
  styleUrl: './tablero-presupuestario.css',
})
export class TableroPresupuestario implements OnChanges, OnDestroy {
  private readonly consultasPresupuestarias = inject(ConsultasPresupuestarias);
  private consulta?: Subscription;
  private contextoDatos = '';
  private seleccionObservada = '';
  private seleccionDatos: string | null = null;
  private readonly cambiosSeleccion = new Subject<string | null>();
  private readonly esperaSeleccion = this.cambiosSeleccion
    .pipe(debounceTime(250))
    .subscribe((seleccion) => {
      if (seleccion === null) return;
      // Si el usuario deshace sus cambios durante la espera, los datos vigentes siguen sirviendo.
      if (
        this.datos &&
        !this.error &&
        this.contextoDatos === this.contextoConsulta &&
        this.seleccionDatos === seleccion
      )
        return;
      this.cargar(true);
    });

  ngOnDestroy(): void {
    this.esperaSeleccion.unsubscribe();
    this.cambiosSeleccion.complete();
    this.consulta?.unsubscribe();
  }

  readonly idCentroCosto = input.required<number>();
  readonly idPresupuesto = input<number | null>(null);
  /** Nivel de anidamiento de los rubros (1 = categorías principales); null = partidas finales. */
  readonly nivel = input<number | null>(null);
  readonly partidasExcluidas = input<readonly number[]>([]);
  readonly partidas = input<readonly PartidaCatalogo[]>([]);
  /** Nivel más profundo de las partidas del tablero, para el rango del selector del panel. */
  readonly nivelMaximo = output<number>();

  /** Orden fijo de la paleta categórica; "Otros" siempre en gris neutro. */
  static readonly COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
  static readonly COLOR_OTROS = '#a9a79f';
  static readonly MAX_SEGMENTOS = 5;

  datos: Tablero | null = null;
  cargando = false;
  /** Rama elegida con clic en la dona; null = todo el centro de costo. */
  idPartidaPadre: number | null = null;
  private readonly categorias = computed(
    () =>
      new Set(
        this.partidas()
          .filter((p) => !p.esHoja)
          .map((p) => p.idCatalogoPartida),
      ),
  );
  error = '';

  segmentos: Segmento[] = [];
  segmentoActivo: Segmento | null = null;
  verTablaSemanal = false;

  // Geometría del gráfico de líneas (en unidades del viewBox).
  readonly ancho = 720;
  readonly alto = 300;
  readonly margen = { arriba: 16, derecha: 16, abajo: 36, izquierda: 64 };
  rutaReal = '';
  rutaPlan = '';
  areaEntreCurvas = '';
  areaSobrePlan = '';
  ticksY: { valor: number; y: number }[] = [];
  ticksX: { semana: number; x: number }[] = [];
  puntoFinReal: Punto | null = null;
  /** Línea horizontal del presupuesto total cuando no hay cronograma (sin curva planificada). */
  referenciaTotal: { valor: number; y: number } | null = null;
  /** Hay al menos una semana con el gasto real por encima del presupuesto acumulado. */
  hayExceso = false;
  hover: { x: number; punto: TableroPuntoSemana; izquierda: boolean } | null = null;
  private puntosX: { x: number; punto: TableroPuntoSemana }[] = [];

  private readonly compacto = new Intl.NumberFormat('es-PE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  private readonly cdr = inject(ChangeDetectorRef);

  ngOnChanges(cambios: SimpleChanges): void {
    if (!this.idCentroCosto()) return;
    const cambiaContexto = !!(
      cambios['idCentroCosto'] ||
      cambios['idPresupuesto'] ||
      cambios['nivel']
    );
    const seleccion = this.exclusionesNormalizadas.join(',');
    const cambiaSeleccion = seleccion !== this.seleccionObservada;
    this.seleccionObservada = seleccion;
    if (cambiaContexto) {
      this.idPartidaPadre = null;
      this.cargar();
    } else if (cambios['partidasExcluidas'] && cambiaSeleccion) {
      // Cancelar ahora impide que una respuesta antigua se aplique durante el debounce.
      this.consulta?.unsubscribe();
      this.cargando = false;
      this.cambiosSeleccion.next(seleccion);
    }
  }

  private get exclusionesNormalizadas(): number[] {
    return [...new Set(this.partidasExcluidas())].sort((a, b) => a - b);
  }

  private get contextoConsulta(): string {
    const nivel = this.idPartidaPadre ? null : this.nivel();
    return `${this.idCentroCosto()}:${this.idPresupuesto()}:${nivel}:${this.idPartidaPadre}`;
  }

  cargar(soloExclusiones = false): void {
    // Las cargas inmediatas invalidan cualquier selección pendiente del contexto anterior.
    this.cambiosSeleccion.next(null);
    this.cargando = true;
    this.error = '';
    // Dentro de una rama se agrupa por sus hijas directas: el nivel del filtro no aplica.
    const nivel = this.idPartidaPadre ? null : this.nivel();
    const contexto = this.contextoConsulta;
    const exclusiones = this.exclusionesNormalizadas;
    const soloDistribucion = soloExclusiones && contexto === this.contextoDatos;
    this.consulta?.unsubscribe();
    this.consulta = this.consultasPresupuestarias
      .dashboard(
        this.idCentroCosto(),
        this.idPresupuesto(),
        nivel,
        this.idPartidaPadre,
        exclusiones,
      )
      .subscribe({
        next: (datos) => {
          this.datos =
            soloDistribucion && this.datos
              ? { ...this.datos, rubrosFiltrados: datos.rubrosFiltrados }
              : datos;
          this.contextoDatos = contexto;
          this.seleccionDatos = exclusiones.join(',');
          this.cargando = false;
          const maximo = Number(datos?.encabezado?.nivelMaximo);
          if (!soloDistribucion && maximo > 0) this.nivelMaximo.emit(maximo);
          this.construirDona();
          if (!soloDistribucion) this.construirLineas();
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          // No mostrar una distribución anterior como si correspondiera a las exclusiones actuales.
          this.seleccionDatos = null;
          if (this.datos) this.datos = { ...this.datos, rubrosFiltrados: [] };
          this.segmentos = [];
          this.segmentoActivo = null;
          this.cargando = false;
          this.error = extraerMensajeError(err, 'No se pudo cargar el dashboard.');
          this.cdr.detectChanges();
        },
      });
  }

  // ------------------------------------------------------------ drill-down

  puedeBajar(rubro: TableroRubro | null): boolean {
    const id = Number(rubro?.idCatalogoPartida);
    return !!id && this.categorias().has(id);
  }

  /** Clic en un segmento o fila: el tablero entero se limita a esa rama. */
  bajarA(rubro: TableroRubro | null): void {
    if (!rubro || !this.puedeBajar(rubro) || this.cargando) return;
    this.idPartidaPadre = Number(rubro.idCatalogoPartida);
    this.cargar();
  }

  /** Breadcrumb: null vuelve a todo el centro de costo. */
  irARama(idCatalogoPartida: number | null): void {
    if (this.cargando || idCatalogoPartida === this.idPartidaPadre) return;
    this.idPartidaPadre = idCatalogoPartida;
    this.cargar();
  }

  get hayNavegables(): boolean {
    return this.rubrosDistribucion.some((r) => this.puedeBajar(r));
  }

  get rama(): TableroRama[] {
    return this.datos?.encabezado?.rama ?? [];
  }

  /** "Nivel N" con el nivel aplicado por el backend; "partida" sin agrupar. */
  get etiquetaAgrupacion(): string {
    const nivel = this.datos?.encabezado?.nivel;
    return nivel ? `Nivel ${nivel}` : 'partida';
  }

  get simbolo(): string {
    return this.datos?.encabezado?.simboloMoneda || this.datos?.encabezado?.codigoMoneda || '';
  }

  /** Distribución del backend con sus importes originales, incluidos ceros y negativos. */
  get rubrosDistribucion(): TableroRubro[] {
    return this.datos?.rubrosFiltrados ?? [];
  }

  get totalDistribucion(): number {
    return this.rubrosDistribucion.reduce((total, r) => total + r.ejecutado, 0);
  }

  get mensajeDistribucionVacia(): string {
    if (this.error) return 'La distribución no está disponible. Reintenta la consulta.';
    if (!this.rubrosDistribucion.length)
      return 'No hay partidas incluidas con datos para esta distribución.';
    return 'Estos importes no se pueden representar en un donut: hay valores negativos o el total neto no es positivo. Consulta los valores con su signo en la tabla.';
  }

  /** Código y nombre de la categoría o partida, si el backend manda el código. */
  nombreRubro(rubro: Pick<TableroRubro, 'codigo' | 'nombre'>): string {
    return rubro?.codigo ? `${rubro.codigo} ${rubro.nombre}` : (rubro?.nombre ?? '');
  }

  colorRubro(indice: number): string {
    return indice < TableroPresupuestario.MAX_SEGMENTOS
      ? TableroPresupuestario.COLORES[indice]
      : TableroPresupuestario.COLOR_OTROS;
  }

  formatoCompacto(valor: number): string {
    return this.compacto.format(valor);
  }

  // ------------------------------------------------------------------ dona

  private construirDona(): void {
    const rubros = this.rubrosDistribucion;
    const total = rubros.reduce((acc, r) => acc + Number(r.ejecutado), 0);
    this.segmentoActivo = null;
    if (total <= 0 || rubros.some((r) => r.ejecutado < 0)) {
      this.segmentos = [];
      return;
    }
    const max = TableroPresupuestario.MAX_SEGMENTOS;
    const base: Omit<Segmento, 'porcentaje' | 'path'>[] = rubros
      .slice(0, max)
      .filter((r) => r.ejecutado > 0)
      .map((r) => ({
        nombre: this.nombreRubro(r),
        monto: Number(r.ejecutado),
        color: this.colorRubro(rubros.indexOf(r)),
        rubro: r,
      }));
    const resto = rubros.slice(max).reduce((acc, r) => acc + Number(r.ejecutado), 0);
    if (resto !== 0)
      base.push({
        nombre: 'Otros',
        monto: resto,
        color: TableroPresupuestario.COLOR_OTROS,
        rubro: null,
      });

    let angulo = -Math.PI / 2;
    this.segmentos = base.map((s) => {
      const fraccion = s.monto / total;
      const inicio = angulo;
      angulo += fraccion * 2 * Math.PI;
      return { ...s, porcentaje: fraccion * 100, path: this.arco(inicio, angulo, 90, 58) };
    });
  }

  /** Sector de anillo; con un solo segmento se dibuja el anillo completo en dos mitades. */
  private arco(inicio: number, fin: number, rExt: number, rInt: number): string {
    if (fin - inicio >= 2 * Math.PI - 1e-6) {
      return (
        this.arco(inicio, inicio + Math.PI, rExt, rInt) +
        ' ' +
        this.arco(inicio + Math.PI, fin, rExt, rInt)
      );
    }
    const c = 100;
    const p = (r: number, a: number) =>
      `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
    const grande = fin - inicio > Math.PI ? 1 : 0;
    return (
      `M ${p(rExt, inicio)} A ${rExt} ${rExt} 0 ${grande} 1 ${p(rExt, fin)} ` +
      `L ${p(rInt, fin)} A ${rInt} ${rInt} 0 ${grande} 0 ${p(rInt, inicio)} Z`
    );
  }

  // ---------------------------------------------------------------- líneas

  private construirLineas(): void {
    const semanas: TableroPuntoSemana[] = this.datos?.semanas ?? [];
    this.hover = null;
    if (!semanas.length) {
      this.rutaReal = this.rutaPlan = this.areaEntreCurvas = this.areaSobrePlan = '';
      this.hayExceso = false;
      this.puntosX = [];
      this.referenciaTotal = null;
      this.ticksX = [];
      this.ticksY = [];
      this.puntoFinReal = null;
      return;
    }
    const { arriba, derecha, abajo, izquierda } = this.margen;
    const ancho = this.ancho - izquierda - derecha;
    const alto = this.alto - arriba - abajo;
    const maxSemana = Math.max(1, ...semanas.map((s) => Number(s.semana)));
    // Sin cronograma no hay curva planificada: el presupuesto total se dibuja como referencia horizontal.
    const totalPresupuesto = Number(this.datos?.resumen?.presupuestado ?? 0);
    const usaReferencia = this.datos?.encabezado?.tieneCronograma === false && totalPresupuesto > 0;
    const valores = semanas
      .flatMap((s) => [s.realAcumulado, s.presupuestoAcumulado])
      .filter((v) => v !== null && v !== undefined)
      .map(Number);
    if (usaReferencia) valores.push(totalPresupuesto);
    const { paso: pasoY, techo: maxValor } = this.escalaLimpia(Math.max(1, ...valores));
    const x = (semana: number) => izquierda + (semana / maxSemana) * ancho;
    const y = (valor: number) => arriba + alto - (valor / maxValor) * alto;
    this.referenciaTotal = usaReferencia
      ? { valor: totalPresupuesto, y: y(totalPresupuesto) }
      : null;

    const reales = semanas
      .filter((s) => s.realAcumulado !== null)
      .map((s) => ({ x: x(Number(s.semana)), y: y(Number(s.realAcumulado)) }));
    const plan = semanas
      .filter((s) => s.presupuestoAcumulado !== null)
      .map((s) => ({ x: x(Number(s.semana)), y: y(Number(s.presupuestoAcumulado)) }));
    this.rutaReal = this.ruta(reales);
    this.rutaPlan = this.ruta(plan);
    this.puntoFinReal = reales.length ? reales[reales.length - 1] : null;

    // Sombreado de la desviación: la franja entre curvas, recortada a donde el real va por encima.
    const conAmbos = semanas.filter(
      (s) => s.realAcumulado !== null && s.presupuestoAcumulado !== null,
    );
    this.hayExceso = conAmbos.some((s) => Number(s.realAcumulado) > Number(s.presupuestoAcumulado));
    if (conAmbos.length > 1) {
      const sup = conAmbos.map(
        (s) => `${x(Number(s.semana)).toFixed(1)},${y(Number(s.realAcumulado)).toFixed(1)}`,
      );
      const inf = [...conAmbos]
        .reverse()
        .map(
          (s) =>
            `${x(Number(s.semana)).toFixed(1)},${y(Number(s.presupuestoAcumulado)).toFixed(1)}`,
        );
      this.areaEntreCurvas = [...sup, ...inf].join(' ');
      const planPts = plan.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      this.areaSobrePlan = [
        ...planPts,
        `${plan[plan.length - 1].x.toFixed(1)},${arriba}`,
        `${plan[0].x.toFixed(1)},${arriba}`,
      ].join(' ');
    } else {
      this.areaEntreCurvas = this.areaSobrePlan = '';
    }

    this.ticksY = [];
    for (let v = 0; v <= maxValor + pasoY / 2; v += pasoY) this.ticksY.push({ valor: v, y: y(v) });
    const paso = maxSemana > 30 ? 4 : maxSemana > 12 ? 2 : 1;
    this.ticksX = [];
    for (let s = 0; s <= maxSemana; s += paso) this.ticksX.push({ semana: s, x: x(s) });
    this.puntosX = semanas.map((s) => ({ x: x(Number(s.semana)), punto: s }));
  }

  private ruta(puntos: Punto[]): string {
    return puntos.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  /**
   * Escala del eje Y con marcas redondas: unas 3-5 divisiones cuyo paso es 1, 2,
   * 2.5 o 5 × 10^n, y el techo es el primer múltiplo del paso que cubre el máximo.
   */
  private escalaLimpia(maximo: number): { paso: number; techo: number } {
    const bruto = maximo / 5;
    const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
    const paso = ([1, 2, 2.5, 5, 10].find((p) => bruto <= p * potencia) ?? 10) * potencia;
    return { paso, techo: Math.ceil(maximo / paso) * paso };
  }

  /** Crosshair: la línea vertical busca la semana más cercana al puntero. */
  onMoverPuntero(evento: PointerEvent, svg: Element): void {
    if (!this.puntosX.length) return;
    const rect = svg.getBoundingClientRect();
    const xVista = ((evento.clientX - rect.left) / rect.width) * this.ancho;
    let cercano = this.puntosX[0];
    for (const p of this.puntosX)
      if (Math.abs(p.x - xVista) < Math.abs(cercano.x - xVista)) cercano = p;
    this.hover = { x: cercano.x, punto: cercano.punto, izquierda: cercano.x > this.ancho * 0.6 };
  }

  onSalirPuntero(): void {
    this.hover = null;
  }

  porcentajeX(x: number): number {
    return (x / this.ancho) * 100;
  }

  desviacionDe(punto: TableroPuntoSemana): number | null {
    return punto?.realAcumulado !== null && punto?.presupuestoAcumulado !== null
      ? Number(punto.realAcumulado) - Number(punto.presupuestoAcumulado)
      : null;
  }

  /** Los cinco rubros que más se desvían (la tabla lateral); el total suma todos. */
  get topDesviaciones(): TableroDesviacionRubro[] {
    return (this.datos?.desviacionPorRubro ?? []).slice(0, 5);
  }

  /** El signo lo da la flecha (▲ sobre, ▼ debajo): el monto se muestra sin signo. */
  abs(valor: number): number {
    return Math.abs(Number(valor) || 0);
  }

  get totalDesviacionRubros(): number {
    return (this.datos?.desviacionPorRubro ?? []).reduce(
      (acc: number, r: TableroDesviacionRubro) => acc + Number(r.desviacion),
      0,
    );
  }
}
