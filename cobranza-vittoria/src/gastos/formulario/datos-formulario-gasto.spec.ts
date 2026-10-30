import {
  construirPeticionGasto,
  DatosFormularioGasto,
  validarFormularioGasto,
} from './datos-formulario-gasto';
import { categoriasGastoPrueba, partidaGastoPrueba, peticionGastoPrueba } from '../gastos.fixture';

const datos: DatosFormularioGasto = {
  ...peticionGastoPrueba,
  idCentroCosto: 12,
  idProveedor: '',
  descripcion: '',
  facturaOtraMoneda: false,
  idMonedaOriginal: '',
  montoOriginal: null,
  tipoCambio: null,
  fechaTipoCambio: '',
};
describe('Formulario de Gastos: validación y petición', () => {
  it('permite registrar por encima del saldo sin confirmar ni convertir importes', () => {
    const excedido = { ...datos, monto: 9999 };
    expect(validarFormularioGasto(excedido, categoriasGastoPrueba, partidaGastoPrueba)).toBe('');
    expect(construirPeticionGasto(excedido)).toEqual({ ...peticionGastoPrueba, monto: 9999 });
  });
  it.each([
    [{ idCategoriaGasto: '' }, 'categoría'],
    [{ idCentroCosto: '' }, 'centro de costo'],
    [{ idPresupuestoDetalle: '' }, 'partida'],
    [{ concepto: ' ' }, 'concepto'],
    [{ concepto: 'x'.repeat(251) }, '250'],
    [{ descripcion: 'x'.repeat(501) }, '500'],
    [{ fecha: '' }, 'fecha'],
    [{ monto: 0 }, 'mayor'],
    [{ monto: NaN }, 'mayor'],
    [{ monto: Infinity }, 'mayor'],
    [{ idMoneda: 2 }, 'moneda'],
    [{ facturaOtraMoneda: true }, 'tipo de cambio'],
    [{ facturaOtraMoneda: true, idMonedaOriginal: 1, montoOriginal: 5, tipoCambio: 1 }, 'distinta'],
  ] satisfies [Partial<DatosFormularioGasto>, string][])(
    'rechaza datos incompletos o incompatibles: %j',
    (cambio, mensaje) => {
      expect(
        validarFormularioGasto({ ...datos, ...cambio }, categoriasGastoPrueba, partidaGastoPrueba),
      ).toContain(mensaje);
    },
  );
  it('solo envía la referencia completa al marcar factura en otra moneda', () => {
    const original = {
      ...datos,
      idMonedaOriginal: 2,
      montoOriginal: 25,
      tipoCambio: 4,
      fechaTipoCambio: '2026-10-07',
    };
    expect(construirPeticionGasto(original).montoOriginal).toBeNull();
    const referencia = { ...original, facturaOtraMoneda: true };
    expect(validarFormularioGasto(referencia, categoriasGastoPrueba, partidaGastoPrueba)).toBe('');
    expect(construirPeticionGasto(referencia)).toEqual({
      ...peticionGastoPrueba,
      idMonedaOriginal: 2,
      montoOriginal: 25,
      tipoCambio: 4,
      fechaTipoCambio: '2026-10-07',
    });
  });
  it('no permite guardar una partida que no pudo recuperarse', () => {
    expect(validarFormularioGasto(datos, categoriasGastoPrueba, null)).toContain('partida');
  });
});
