import { HttpErrorResponse } from '@angular/common/http';
import { esCodigoError, extraerMensajeError, obtenerErrores } from './api-error.util';

describe('Errores de API en el límite sin tipado', () => {
  it('prioriza detalles 422 y conserva su orden por encima de errors y message', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        message: 'Datos rechazados.',
        errores: [
          { fila: 7, campo: 'Monto', codigoError: 'FORMATO_INVALIDO', mensaje: 'Monto inválido.' },
          { campo: 'Fecha', codigoError: 'CAMPO_REQUERIDO', mensaje: 'Fecha requerida.' },
        ],
        errors: { Campo: ['No se debe mostrar este mensaje.'] },
      },
    });
    expect(extraerMensajeError(error)).toBe(
      'Datos rechazados. 1) Monto inválido. 2) Fecha requerida.',
    );
    expect(obtenerErrores(error)).toEqual([
      { fila: 7, campo: 'Monto', codigoError: 'FORMATO_INVALIDO', mensaje: 'Monto inválido.' },
      { fila: null, campo: 'Fecha', codigoError: 'CAMPO_REQUERIDO', mensaje: 'Fecha requerida.' },
    ]);
  });

  it('conserva mensajes de DataAnnotations por campo', () => {
    expect(
      extraerMensajeError({
        error: {
          errors: { Fecha: ['Fecha requerida.', 'Fecha inválida.'], Monto: 'Monto inválido.' },
          message: 'General',
        },
      }),
    ).toBe('Fecha requerida. Fecha inválida. Monto inválido.');
  });

  it('reconoce códigos aunque el validador no informe fila, campo ni mensaje', () => {
    const error = { error: { errores: [{ codigoError: 'STOCK_PROYECTO_NO_INICIALIZADO' }] } };
    expect(esCodigoError(error, 'STOCK_PROYECTO_NO_INICIALIZADO')).toBe(true);
    expect(esCodigoError(error, 'STOCK_INSUFICIENTE')).toBe(false);
    expect(extraerMensajeError(error)).toBe('La operación fue rechazada. 1) Error sin detalle.');
  });

  it.each([
    null,
    undefined,
    'sin estructura',
    42,
    { error: null },
    { error: { errores: 'inválido' } },
  ])('usa un respaldo para datos desconocidos: %j', (error) => {
    expect(extraerMensajeError(error, 'Respaldo')).toBe('Respaldo');
    expect(esCodigoError(error, 'STOCK_INSUFICIENTE')).toBe(false);
    expect(obtenerErrores(error)).toEqual([]);
  });

  it('admite errores nativos y prioriza el mensaje del servidor', () => {
    expect(extraerMensajeError(new Error('Fallo nativo'))).toBe('Fallo nativo');
    expect(extraerMensajeError({ message: 'Local', error: { message: 'Servidor' } })).toBe(
      'Servidor',
    );
  });

  it('tolera entradas malformadas en errores[] sin lanzar excepciones', () => {
    const error = {
      error: { errores: [null, 'incorrecto', { fila: '7', mensaje: 'Revisar datos.' }] },
    };
    expect(extraerMensajeError(error)).toBe(
      'La operación fue rechazada. 1) Error sin detalle. 2) Error sin detalle. 3) Revisar datos.',
    );
    expect(obtenerErrores(error).map((detalle) => detalle.fila)).toEqual([null, null, null]);
  });
});
