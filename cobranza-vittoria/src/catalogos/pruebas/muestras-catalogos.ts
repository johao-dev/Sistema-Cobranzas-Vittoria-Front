import { Especialidad, EspecialidadUpsert } from '../especialidades/contratos-especialidades';
import { UnidadMedida, UnidadMedidaUpsert } from '../unidades-medida/contratos-unidades-medida';
import { Proyecto, ProyectoUpsert } from '../proyectos/contratos-proyectos';
import { Material, MaterialUpsert } from '../materiales/contratos-materiales';
import { Proveedor, ProveedorUpsert } from '../proveedores/contratos-proveedores';

export const ESPECIALIDAD: Especialidad = {
  idEspecialidad: 1,
  nombre: 'Estructuras',
  descripcion: 'Obra',
  activo: true,
};
export const ESPECIALIDAD_REQUEST: EspecialidadUpsert = {
  idEspecialidad: null,
  nombre: 'Estructuras',
  descripcion: 'Obra',
  activo: true,
};
export const UNIDAD: UnidadMedida = {
  idUnidadMedida: 1,
  codigo: 'KG',
  nombre: 'Kilogramo',
  activo: true,
};
export const UNIDAD_REQUEST: UnidadMedidaUpsert = { ...UNIDAD, idUnidadMedida: null };
export const PROYECTO: Proyecto = {
  idProyecto: 1,
  nombreProyecto: 'Obra central',
  descripcion: 'Obra',
  cotizacionGeneral: 100,
  activo: true,
};
export const PROYECTO_REQUEST: ProyectoUpsert = {
  idProyecto: null,
  nombreProyecto: 'Obra central',
  descripcion: 'Obra',
  cotizacionGeneral: 100,
  activo: true,
};
export const MATERIAL: Material = {
  idMaterial: 1,
  idEspecialidad: 1,
  codigo: 'MAT-001',
  codigoProveedor: 'P-1',
  descripcion: 'Cemento',
  unidadMedida: 'KG',
  stockMinimo: 0,
  activo: true,
  idCatalogoPartida: 7,
  codigoPartida: '01',
  nombrePartida: 'Cimentación',
};
export const MATERIAL_REQUEST: MaterialUpsert = {
  idMaterial: null,
  idEspecialidad: 1,
  codigo: '',
  codigoProveedor: 'P-1',
  descripcion: 'Cemento',
  unidadMedida: 'KG',
  stockMinimo: 0,
  activo: true,
  idCatalogoPartida: 7,
};
export const PROVEEDOR: Proveedor = {
  idProveedor: 1,
  razonSocial: 'Proveedor',
  ruc: '20123456789',
  activo: true,
};
export const PROVEEDOR_REQUEST: ProveedorUpsert = {
  idProveedor: null,
  razonSocial: 'Proveedor',
  ruc: '20123456789',
  contacto: '',
  telefono: '',
  correo: '',
  direccion: '',
  banco: '',
  cuentaCorriente: '',
  cci: '',
  cuentaDetraccion: '',
  descripcionServicio: '',
  observacion: '',
  trabajamosConProveedor: 'SI',
  activo: true,
};

// jsdom no implementa showModal/close. Se simula solo el límite nativo, no su gestión de foco.
export function simularDialogosNativos(): () => void {
  const prototipo = HTMLDialogElement.prototype;
  const abrir = Object.getOwnPropertyDescriptor(prototipo, 'showModal');
  const cerrar = Object.getOwnPropertyDescriptor(prototipo, 'close');
  Object.defineProperty(prototipo, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement): void {
      this.open = true;
    },
  });
  Object.defineProperty(prototipo, 'close', {
    configurable: true,
    value(this: HTMLDialogElement): void {
      this.open = false;
    },
  });
  return () => {
    if (abrir) Object.defineProperty(prototipo, 'showModal', abrir);
    else Reflect.deleteProperty(prototipo, 'showModal');
    if (cerrar) Object.defineProperty(prototipo, 'close', cerrar);
    else Reflect.deleteProperty(prototipo, 'close');
  };
}

export function obtenerRaiz(elemento: unknown): HTMLElement {
  if (!(elemento instanceof HTMLElement)) throw new Error('No se creó la vista.');
  return elemento;
}

export function obtenerElemento<T extends Element>(raiz: HTMLElement, selector: string): T {
  const elemento: T | null = raiz.querySelector<T>(selector);
  if (!elemento) throw new Error(`No se encontró ${selector}.`);
  return elemento;
}

export function escribir(raiz: HTMLElement, selector: string, valor: string): void {
  const campo: HTMLInputElement = obtenerElemento(raiz, selector);
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

export function enviar(raiz: HTMLElement): void {
  obtenerElemento<HTMLFormElement>(raiz, 'form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
}
