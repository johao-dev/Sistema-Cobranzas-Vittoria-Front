import { crearCsvPresupuestario } from './exportacion-presupuestaria';

describe('CSV presupuestario', () => {
  it('alinea columnas aunque las propiedades de otras filas vengan en otro orden', () => {
    expect(
      crearCsvPresupuestario([
        { codigo: '01', monto: 10 },
        { monto: 20, codigo: '02' },
      ]),
    ).toBe('codigo;monto\r\n"01";"10"\r\n"02";"20"');
  });
  it('escapa comillas, saltos de línea y separadores; conserva 0 y false', () => {
    expect(
      crearCsvPresupuestario([
        { nombre: 'Obra; "A"\nSur', monto: 0, excedido: false, moneda: null },
      ]),
    ).toBe('nombre;monto;excedido;moneda\r\n"Obra; ""A""\nSur";"0";"false";""');
  });
});
