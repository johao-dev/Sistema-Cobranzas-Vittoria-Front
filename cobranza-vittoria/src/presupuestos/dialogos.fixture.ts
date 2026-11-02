/** jsdom no implementa showModal; el foco y el teclado nativos se validan en navegador. */
export function simularDialogosPresupuestos(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    },
  });
  return () => {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  };
}
