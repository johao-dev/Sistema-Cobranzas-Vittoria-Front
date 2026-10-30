export interface ProveedorGasto {
  idProveedorGastoAdministrativo: number;
  idCategoriaGasto: number | null;
  categoria: string | null;
  razonSocial: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface ProveedorGastoUpsert {
  razonSocial: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  idProveedorGastoAdministrativo: number | null;
  idCategoriaGasto: number;
}
