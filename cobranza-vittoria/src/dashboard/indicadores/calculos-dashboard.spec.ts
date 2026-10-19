import { describe, expect, it } from 'vitest';
import {
  agruparMateriales,
  calcularTarjetas,
  construirFilas,
  formatearImporte,
} from './calculos-dashboard';
import { EstadisticaMaterial } from '../contratos-dashboard';
import {
  crearCompra,
  crearDetalle,
  crearItem,
  crearValorizacion,
} from '../pruebas/muestras-dashboard';

describe('Cálculos históricos del dashboard', () => {
  it('suma compras y valorizaciones en el orden de las cinco tarjetas', () => {
    const tarjetas = calcularTarjetas(
      [crearCompra(), crearCompra({ MontoTotal: 25 })],
      [crearValorizacion(), crearValorizacion()],
    );
    expect(tarjetas.map((tarjeta) => tarjeta.value)).toEqual([125, 160, 100, 10, 6]);
  });

  it('devuelve cero en todas las tarjetas sin datos', () => {
    expect(calcularTarjetas([], []).map((tarjeta) => tarjeta.value)).toEqual([0, 0, 0, 0, 0]);
    expect(agruparMateriales([])).toEqual([]);
    expect(construirFilas([], 'cantidad')).toEqual([]);
  });

  it('conserva la suma nominal de monedas distintas sin introducir conversiones', () => {
    const tarjetas = calcularTarjetas(
      [crearCompra({ CodigoMoneda: 'PEN' }), crearCompra({ CodigoMoneda: 'USD' })],
      [crearValorizacion({ moneda: 'USD' })],
    );
    expect(tarjetas[0]?.value).toBe(200);
    expect(formatearImporte(tarjetas[0]?.value ?? 0)).toBe('PEN 200.00');
  });

  it('agrupa por nombre recortado y cuenta cada línea aunque pertenezca a la misma compra', () => {
    const materiales = agruparMateriales([
      crearDetalle([
        crearItem({ Material: ' Cemento ' }),
        crearItem({
          IdMaterial: 2,
          Material: 'Cemento',
          Cantidad: 1,
          Subtotal: 0,
          PrecioUnitario: 10,
        }),
      ]),
    ]);
    expect(materiales).toEqual([{ material: 'Cemento', cantidad: 3, monto: 40, frecuencia: 2 }]);
  });

  it('conserva nombres sensibles a mayúsculas y la etiqueta del material vacío', () => {
    expect(
      agruparMateriales([
        crearDetalle([
          crearItem({ Material: 'Cemento' }),
          crearItem({ Material: 'cemento' }),
          crearItem({ Material: '   ' }),
        ]),
      ]).map((material) => material.material),
    ).toEqual(['Cemento', 'cemento', '-']);
  });

  it('redondea los acumulados a dos decimales en cada línea', () => {
    const materiales = agruparMateriales([
      crearDetalle([
        crearItem({ Cantidad: 0.105, Subtotal: 0.105 }),
        crearItem({ Cantidad: 0.105, Subtotal: 0.105 }),
      ]),
    ]);
    expect(materiales[0]).toMatchObject({ cantidad: 0.22, monto: 0.22 });
  });

  it('ordena sin mutar los datos y conserva el orden de entrada en empates', () => {
    const materiales: EstadisticaMaterial[] = [
      { material: 'A', cantidad: 1, monto: 1, frecuencia: 1 },
      { material: 'B', cantidad: 100, monto: 1, frecuencia: 1 },
      { material: 'C', cantidad: 100, monto: 2, frecuencia: 2 },
    ];
    const filas = construirFilas(materiales, 'cantidad');
    expect(filas.map((fila) => fila.label)).toEqual(['B', 'C', 'A']);
    expect(filas.map((fila) => fila.width)).toEqual([100, 100, 6]);
    expect(materiales[0]?.material).toBe('A');
    expect(construirFilas(materiales, 'monto')[0]?.label).toBe('C');
    expect(construirFilas(materiales, 'frecuencia')[0]?.value).toBe(2);
  });

  it('usa ancho cero cuando todas las métricas son cero', () => {
    expect(
      construirFilas([{ material: 'A', cantidad: 0, monto: 0, frecuencia: 0 }], 'cantidad')[0]
        ?.width,
    ).toBe(0);
  });

  it('conserva el formato monetario existente con dos decimales', () => {
    expect(formatearImporte(1234.5)).toBe('PEN 1,234.50');
    expect(formatearImporte(-3)).toBe('PEN -3.00');
  });
});
