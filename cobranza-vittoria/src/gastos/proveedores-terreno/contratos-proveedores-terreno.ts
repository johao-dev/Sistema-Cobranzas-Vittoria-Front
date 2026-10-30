export interface ProveedorTerreno {
  idProveedorTerreno: number;
  razonSocial: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  fechaCreacion: string;
}

export interface ProveedorTerrenoUpsert {
  razonSocial: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  idProveedorTerreno: number | null;
}
