export interface Especialidad {
  idEspecialidad: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  fechaCreacion?: string;
}

export interface Proyecto {
  idProyecto: number;
  nombreProyecto: string;
  descripcion?: string | null;
  activo: boolean;
}

export interface Proveedor {
  idProveedor: number;
  razonSocial: string;
  ruc: string;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  banco?: string | null;
  cuentaCorriente?: string | null;
  cci?: string | null;
  cuentaDetraccion?: string | null;
  descripcionServicio?: string | null;
  observacion?: string | null;
  trabajamosConProveedor?: string | null;
  activo: boolean;
}

export interface UnidadMedida {
  idUnidadMedida: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface Material {
  idMaterial: number;
  idEspecialidad: number;
  especialidad?: string | null;
  codigo?: string | null;
  descripcion: string;
  unidadMedida?: string | null;
  idUnidadMedida?: number | null;
  stockMinimo: number;
  activo: boolean;
}