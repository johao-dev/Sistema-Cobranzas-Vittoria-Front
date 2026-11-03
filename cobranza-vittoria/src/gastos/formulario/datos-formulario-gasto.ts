import {
  CategoriaGasto,
  GastoDirectoRequest,
  PartidaDisponibleGastoDirecto,
} from '../contratos-gastos-directos';

export interface DatosFormularioGasto {
  idCategoriaGasto: number | '';
  idCentroCosto: number | '';
  idPresupuestoDetalle: number | '';
  idProveedor: number | '';
  idMoneda: number | '';
  fecha: string;
  concepto: string;
  descripcion: string;
  monto: number | null;
  facturaOtraMoneda: boolean;
  idMonedaOriginal: number | '';
  montoOriginal: number | null;
  tipoCambio: number | null;
  fechaTipoCambio: string;
}

export function validarFormularioGasto(
  datos: DatosFormularioGasto,
  categorias: CategoriaGasto[],
  partida: PartidaDisponibleGastoDirecto | null,
): string {
  if (!categorias.some((categoria) => categoria.idCategoriaGasto === datos.idCategoriaGasto))
    return 'Selecciona una categoría de gasto disponible.';
  if (!datos.idCentroCosto) return 'Selecciona el centro de costo.';
  if (!datos.idPresupuestoDetalle || !partida)
    return 'Selecciona la partida a la que se carga el gasto.';
  if (!datos.concepto.trim()) return 'Ingresa el concepto del gasto.';
  if (datos.concepto.trim().length > 250 || datos.descripcion.trim().length > 500)
    return 'El concepto admite hasta 250 caracteres y la descripción hasta 500.';
  if (!datos.fecha) return 'Ingresa la fecha del gasto.';
  if (!Number.isFinite(datos.monto) || Number(datos.monto) < 0.01)
    return 'El monto debe ser mayor a cero.';
  if (datos.idMoneda !== partida.idMoneda)
    return 'La moneda debe coincidir con la partida seleccionada.';
  if (datos.facturaOtraMoneda) {
    if (
      !datos.idMonedaOriginal ||
      !Number.isFinite(datos.montoOriginal) ||
      Number(datos.montoOriginal) < 0.01 ||
      !Number.isFinite(datos.tipoCambio) ||
      Number(datos.tipoCambio) < 0.000001
    )
      return 'Completa la moneda, el monto original y el tipo de cambio de la factura.';
    if (datos.idMonedaOriginal === datos.idMoneda)
      return 'La moneda de la factura debe ser distinta de la del presupuesto.';
  }
  return '';
}

export function construirPeticionGasto(datos: DatosFormularioGasto): GastoDirectoRequest {
  return {
    idPresupuestoDetalle: Number(datos.idPresupuestoDetalle),
    idCategoriaGasto: Number(datos.idCategoriaGasto),
    idProveedor: datos.idProveedor === '' ? null : datos.idProveedor,
    idMoneda: Number(datos.idMoneda),
    fecha: datos.fecha,
    concepto: datos.concepto.trim(),
    descripcion: datos.descripcion.trim() || null,
    monto: Number(datos.monto),
    idMonedaOriginal:
      datos.facturaOtraMoneda && datos.idMonedaOriginal !== '' ? datos.idMonedaOriginal : null,
    montoOriginal: datos.facturaOtraMoneda ? datos.montoOriginal : null,
    tipoCambio: datos.facturaOtraMoneda ? datos.tipoCambio : null,
    fechaTipoCambio: datos.facturaOtraMoneda ? datos.fechaTipoCambio || null : null,
  };
}
