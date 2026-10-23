import { mensajeErrorInventario } from './errores-inventario';

describe('Errores de inventario', () => {
  it.each([
    ['STOCK_PROYECTO_NO_INICIALIZADO', 'Contacte al administrador'],
    ['STOCK_PROYECTO_INCONSISTENTE', 'La operación no fue realizada'],
    ['PROYECTOS_IGUALES', 'deben ser diferentes'],
    ['INVENTARIO_OCUPADO', 'vuelva a intentar'],
  ])('traduce %s a una indicación operativa', (codigoError, mensaje) => {
    expect(mensajeErrorInventario({ error: { errores: [{ codigoError }] } }, 'Error')).toContain(
      mensaje,
    );
  });

  it('conserva todos los materiales, proyectos, disponibles y solicitados del contrato SQL', () => {
    const mensaje = mensajeErrorInventario(
      {
        error: {
          errores: [
            {
              codigoError: 'STOCK_PROYECTO_INSUFICIENTE',
              mensaje:
                'idMaterial=10 idProyecto=3 disponible=4.00 solicitado=6.00; idMaterial=11 idProyecto=3 disponible=1.00 solicitado=2.00',
            },
          ],
        },
      },
      'Error',
    );

    expect(mensaje).toContain('No hay stock suficiente');
    expect(mensaje).toContain(
      'Material (ID): 10 Proyecto (ID): 3 Disponible: 4.00 Solicitado: 6.00',
    );
    expect(mensaje).toContain('Material (ID): 11');
  });

  it('conserva errores anteriores y de DataAnnotations', () => {
    expect(
      mensajeErrorInventario({ error: { message: 'Stock global insuficiente' } }, 'Error'),
    ).toBe('Stock global insuficiente');
    expect(
      mensajeErrorInventario({ error: { errors: { Fecha: ['Fecha requerida'] } } }, 'Error'),
    ).toBe('Fecha requerida');
  });
});
