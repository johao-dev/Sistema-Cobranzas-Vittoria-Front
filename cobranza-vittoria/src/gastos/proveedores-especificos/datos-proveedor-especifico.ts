export interface DatosProveedorEspecifico {
  razonSocial: string;
  ruc: string;
  contacto: string;
  telefono: string;
  correo: string;
  activo: boolean;
}

export interface EdicionProveedorEspecifico extends DatosProveedorEspecifico {
  idCategoriaGasto: number | null;
}
