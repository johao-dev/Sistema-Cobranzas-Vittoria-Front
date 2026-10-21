import { vi } from 'vitest';
import { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { CatalogoEspecialidades } from '../../catalogos/especialidades/catalogo-especialidades';
import { CatalogoMateriales } from '../../catalogos/materiales/catalogo-materiales';
import { CatalogoProyectos } from '../../catalogos/proyectos/catalogo-proyectos';
import { CatalogoProveedores } from '../../catalogos/proveedores/catalogo-proveedores';
import { materialesPrueba } from '../inventario.fixture';

export const especialidadesPrueba = [
  { idEspecialidad: 2, nombre: 'Eléctrica', activo: true },
  { idEspecialidad: 5, nombre: 'Civil', activo: true },
];

export const proyectosPrueba = [
  { idProyecto: 3, nombreProyecto: 'Obra', cotizacionGeneral: 0, activo: true },
];

export const proveedoresCatalogosPrueba = [
  { provide: CatalogoEspecialidades, useValue: { especialidades: () => of(especialidadesPrueba) } },
  { provide: CatalogoMateriales, useValue: { materiales: () => of(materialesPrueba) } },
  { provide: CatalogoProyectos, useValue: { proyectos: () => of(proyectosPrueba) } },
  { provide: CatalogoProveedores, useValue: { proveedores: () => of([]) } },
];

export function botonInventario<T>(fixture: ComponentFixture<T>, texto: string): HTMLButtonElement {
  const raiz: HTMLElement = fixture.nativeElement;
  const boton = Array.from(raiz.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === texto,
  );
  if (!boton) throw new Error('No se encontró el botón: ' + texto);

  return boton;
}

export async function escribirInventario<T>(
  fixture: ComponentFixture<T>,
  selector: string,
  valor: string,
): Promise<void> {
  const raiz: HTMLElement = fixture.nativeElement;
  const control = raiz.querySelector(selector);
  if (!(control instanceof HTMLInputElement))
    throw new Error('No se encontró el input: ' + selector);

  control.value = valor;
  control.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

export async function seleccionarInventario<T>(
  fixture: ComponentFixture<T>,
  selector: string,
  texto: string,
): Promise<void> {
  const raiz: HTMLElement = fixture.nativeElement;
  const control = raiz.querySelector(selector);
  if (!(control instanceof HTMLSelectElement))
    throw new Error('No se encontró el select: ' + selector);

  const opcion = Array.from(control.options).find((opcion) => opcion.textContent?.includes(texto));
  if (!opcion) throw new Error('No se encontró la opción: ' + texto);

  control.value = opcion.value;
  control.dispatchEvent(new Event('change'));
  await fixture.whenStable();
}

export function simularDialogosInventario(): void {
  // jsdom no implementa showModal; estado, eventos y vistas de Angular son reales.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(),
  });
}

export function restaurarDialogosInventario(): void {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
}
