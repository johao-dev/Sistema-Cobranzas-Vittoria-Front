import {
  esGastoHistorico,
  montoEnGasto,
  normalizarBusquedaGasto,
  resolverCategoriasPorCodigo,
} from './presentacion-gastos';
import { categoriasGastoPrueba, gastoPrueba } from './gastos.fixture';

describe('Presentación de Gastos', () => {
  it('resuelve códigos sin depender de IDs fijos y comunica faltantes', () => {
    expect(
      resolverCategoriasPorCodigo(categoriasGastoPrueba, [
        ' terreno ',
        'ANTEPROYECTO',
        'inexistente',
      ]),
    ).toEqual({
      categorias: [categoriasGastoPrueba[4], categoriasGastoPrueba[5]],
      faltantes: ['INEXISTENTE'],
    });
  });
  it('distingue el monto presupuestario de la referencia sin conversión', () => {
    expect(montoEnGasto(gastoPrueba, 'PEN')).toEqual({ valor: 100, referencia: false });
    expect(montoEnGasto(gastoPrueba, 'USD')).toEqual({ valor: 25, referencia: true });
    expect(montoEnGasto({ ...gastoPrueba, montoOriginal: null }, 'USD')).toBeNull();
  });
  it('busca sin tildes e identifica únicamente presupuestos históricos', () => {
    expect(normalizarBusquedaGasto(' Técnico ')).toBe('tecnico');
    expect(esGastoHistorico({ ...gastoPrueba, codigoPresupuesto: 'hist-2025' })).toBe(true);
    expect(esGastoHistorico(gastoPrueba)).toBe(false);
  });
});
