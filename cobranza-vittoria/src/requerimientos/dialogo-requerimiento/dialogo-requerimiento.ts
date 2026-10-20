import { afterNextRender, Directive, ElementRef, inject, output } from '@angular/core';

/** El navegador contiene el foco y lo restaura al cerrar, también en diálogos anidados. */
@Directive({
  selector: 'dialog[dialogoRequerimiento]',
  host: {
    '(cancel)': 'cancelar($event)',
    '(pointerdown)': 'cerrarDesdeFondo($event)',
  },
})
export class DialogoRequerimiento {
  readonly solicitarCierre = output<void>();

  private readonly elemento = inject<ElementRef<HTMLDialogElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.elemento.nativeElement.showModal());
  }

  protected cancelar(event: Event): void {
    event.preventDefault();

    this.solicitarCierre.emit();
  }

  protected cerrarDesdeFondo(event: PointerEvent): void {
    const dialogo = this.elemento.nativeElement;

    if (event.target !== dialogo) return;

    const limites = dialogo.getBoundingClientRect();

    if (
      event.clientX < limites.left ||
      event.clientX > limites.right ||
      event.clientY < limites.top ||
      event.clientY > limites.bottom
    )
      this.solicitarCierre.emit();
  }
}
