import {
  documentoRequerimiento,
  imprimirRequerimiento,
  normalizarNombreSolicitante,
} from './impresion-requerimiento';
import { muestraRequerimiento } from '../pruebas/muestras-requerimientos';

describe('Impresión de requerimientos', () => {
  it('escapa los textos de cabecera y detalle antes de escribir HTML', () => {
    const detalle = muestraRequerimiento();

    detalle.requerimiento.nombreProyecto = '<script>alert("obra")</script>';
    detalle.items[0].material = '<img src=x onerror=alert(1)>';
    detalle.items[0].observacion = 'A & B';

    const html = documentoRequerimiento(detalle);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('2.5');
  });

  it('mantiene el documento vacío y las fechas opcionales sin inventar valores', () => {
    const detalle = muestraRequerimiento();

    detalle.items = [];

    const html = documentoRequerimiento(detalle);

    expect(html).toContain('Sin materiales.');
    expect(html).toContain('<strong>Fecha entrega</strong>-');
  });

  it.each([
    ['  Jefe de Almacén ', 'Jefe de Almacen'],
    ['INGENIERO DE OBRA', 'Ingeniero'],
    [' Ana   Pérez ', 'Ana Pérez'],
    [null, '-'],
  ])('preserva la normalización histórica de %s', (entrada, salida) => {
    expect(normalizarNombreSolicitante(entrada)).toBe(salida);
  });

  it('tolera el bloqueo de ventanas emergentes', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);

    expect(() => imprimirRequerimiento(muestraRequerimiento())).not.toThrow();

    abrir.mockRestore();
  });
});
