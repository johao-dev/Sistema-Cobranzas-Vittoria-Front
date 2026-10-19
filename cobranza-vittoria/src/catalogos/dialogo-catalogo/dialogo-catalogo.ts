import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'dialogo-catalogo',
  templateUrl: './dialogo-catalogo.html',
  styleUrl: './dialogo-catalogo.css',
})
export class DialogoCatalogo {
  readonly abierto = input(false);
  readonly titulo = input('Formulario');
  readonly cerrar = output<void>();
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const elemento: HTMLDialogElement | undefined = this.dialogo()?.nativeElement;
      if (!elemento) return;
      // El diálogo nativo gestiona foco, tabulación y restauración del foco al cerrarse.
      if (this.abierto() && !elemento.open) elemento.showModal();
      else if (!this.abierto() && elemento.open) elemento.close();
    });
  }

  protected cancelar(event: Event): void {
    event.preventDefault();
    this.cerrar.emit();
  }

  protected cerrarDesdeFondo(event: PointerEvent): void {
    const elemento: HTMLDialogElement | undefined = this.dialogo()?.nativeElement;
    if (!elemento || event.target !== elemento) return;
    const limites: DOMRect = elemento.getBoundingClientRect();
    if (
      event.clientX < limites.left ||
      event.clientX > limites.right ||
      event.clientY < limites.top ||
      event.clientY > limites.bottom
    )
      this.cerrar.emit();
  }
}
