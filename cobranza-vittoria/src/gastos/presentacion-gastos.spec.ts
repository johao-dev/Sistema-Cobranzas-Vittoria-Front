import { esGastoHistorico, montoEnGasto, normalizarBusquedaGasto } from './presentacion-gastos';
import { gastoPrueba } from './gastos.fixture';

describe('Presentación de Gastos', () => {
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
