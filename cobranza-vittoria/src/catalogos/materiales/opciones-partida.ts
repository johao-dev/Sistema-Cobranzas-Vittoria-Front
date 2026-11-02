import { Material, OpcionPartida } from './contratos-materiales';

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
