import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PartidaCatalogo } from './contratos-partidas';
import { cambiarInclusionPartida, opcionesPartidas } from './seleccion-partidas';
import { normalizarBusqueda } from '../presentacion-presupuestos';

@Component({
  selector: 'selector-partidas',
  imports: [FormsModule],
  templateUrl: './selector-partidas.html',
  styleUrl: './selector-partidas.css',
  host: {
    '(focusout)': 'cerrarAlSalirDelFoco($event)',
    '(document:pointerdown)': 'cerrarDesdeFuera($event)',
  },
})
export class SelectorPartidas {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly desplegable = viewChild<ElementRef<HTMLDetailsElement>>('desplegable');

  readonly partidas = input<readonly PartidaCatalogo[]>([]);
  readonly excluidas = input<readonly number[]>([]);
  readonly deshabilitado = input(false);
  readonly motivo = input('');
  readonly error = input('');
  readonly excluidasChange = output<number[]>();
  readonly reintentar = output<void>();

  protected readonly busqueda = signal('');
  protected readonly opciones = computed(() => opcionesPartidas(this.partidas()));
  private readonly idsExcluidos = computed(() => new Set(this.excluidas()));
  protected readonly filas = computed(() => {
    const termino = normalizarBusqueda(this.busqueda());
    const excluidas = this.idsExcluidos();
    return this.opciones()
      .filter((o) =>
        normalizarBusqueda(`${o.partida.codigo} ${o.partida.nombre}`).includes(termino),
      )
      .map((o) => {
        const cantidad = o.rama.filter((id) => excluidas.has(id)).length;
        return {
          ...o,
          incluida: cantidad === 0,
          parcial: cantidad > 0 && cantidad < o.rama.length,
        };
      });
  });

  protected cambiar(id: number, incluir: boolean): void {
    this.excluidasChange.emit(
      cambiarInclusionPartida(this.opciones(), this.excluidas(), id, incluir),
    );
  }

  protected seleccionarTodas(incluir: boolean): void {
    this.excluidasChange.emit(incluir ? [] : this.partidas().map((p) => p.idCatalogoPartida));
  }

  protected cerrarConEscape(evento: Event, desplegable: HTMLDetailsElement): void {
    evento.preventDefault();
    desplegable.open = false;
    desplegable.querySelector('summary')?.focus();
  }

  protected cerrarAlSalirDelFoco(evento: FocusEvent): void {
    if (
      !(evento.relatedTarget instanceof Node) ||
      !this.elemento.nativeElement.contains(evento.relatedTarget)
    ) {
      this.cerrarDesplegable();
    }
  }

  protected cerrarDesdeFuera(evento: Event): void {
    if (evento.target instanceof Node && !this.elemento.nativeElement.contains(evento.target)) {
      this.cerrarDesplegable();
    }
  }

  private cerrarDesplegable(): void {
    const desplegable = this.desplegable()?.nativeElement;
    if (desplegable) desplegable.open = false;
  }
}
