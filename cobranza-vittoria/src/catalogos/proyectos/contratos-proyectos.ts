export interface Proyecto {
  idProyecto: number;
  nombreProyecto: string;
  descripcion?: string | null;
  cotizacionGeneral: number;
  activo: boolean;
  fechaCreacion?: string;
}
export interface ProyectoUpsert {
  idProyecto: number | null;
  nombreProyecto: string;
  descripcion: string | null;
  cotizacionGeneral: number;
  activo: boolean;
}
