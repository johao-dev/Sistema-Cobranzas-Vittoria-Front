export interface Proveedor {
  idProveedor: number;
  razonSocial: string;
  ruc?: string | null;
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
  fechaCreacion?: string;
}
export interface ProveedorUpsert {
  idProveedor: number | null;
  razonSocial: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  banco: string | null;
  cuentaCorriente: string | null;
  cci: string | null;
  cuentaDetraccion: string | null;
  descripcionServicio: string | null;
  observacion: string | null;
  trabajamosConProveedor: string | null;
  activo: boolean;
}
export interface ProveedorEspecialidad {
  idProveedorEspecialidad: number;
  idProveedor: number;
  idEspecialidad: number;
  especialidad: string | null;
  activo: boolean;
}
export interface DetalleProveedor {
  proveedor: Proveedor;
  especialidades: ProveedorEspecialidad[];
}
export interface ProveedorEspecialidadRequest {
  idProveedor: number;
  idEspecialidad: number;
  activo: boolean;
}
export interface ConsultaRuc {
  razon_social: string;
  numero_documento: string;
  estado: string;
  direccion: string;
  // Proyección de los campos que consume el frontend; la API devuelve otros datos SUNAT.
}
