import { Material, OpcionPartida } from './contratos-materiales';

function esOpcionPartida(valor: unknown): valor is OpcionPartida {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'idCatalogoPartida' in valor &&
    typeof valor.idCatalogoPartida === 'number' &&
    'codigo' in valor &&
    typeof valor.codigo === 'string' &&
    'nombre' in valor &&
    typeof valor.nombre === 'string'
  );
}

// El servicio presupuestario pendiente todavía entrega datos sin tipado; validar ese límite.
export function leerOpcionesPartida(datos: unknown): OpcionPartida[] {
  if (!Array.isArray(datos) || !datos.every(esOpcionPartida))
    throw new Error('Listado de partidas inválido.');
  return datos;
}

export function completarPartidas(
  opciones: readonly OpcionPartida[],
  material: Material | null,
): OpcionPartida[] {
  if (
    !material?.idCatalogoPartida ||
    opciones.some((opcion) => opcion.idCatalogoPartida === material.idCatalogoPartida)
  )
    return [...opciones];
  return [
    ...opciones,
    {
      idCatalogoPartida: material.idCatalogoPartida,
      codigo: material.codigoPartida || '?',
      nombre: `${material.nombrePartida || 'Partida'} (no disponible)`,
    },
  ];
}
