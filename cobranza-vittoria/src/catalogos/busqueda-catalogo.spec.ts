import { describe, expect, it } from 'vitest';
import { filtrarCatalogo } from './busqueda-catalogo';
import { leerOpcionesPartida, completarPartidas } from './materiales/opciones-partida';
import { MATERIAL } from './pruebas/muestras-catalogos';

describe('Búsqueda y opciones compartidas de catálogos', () => {
  it('busca sin distinguir tildes ni mayúsculas y no muta las filas', () => {
    const filas = [
      { nombre: 'Cimentación', activo: true },
      { nombre: 'Pintura', activo: false },
    ];
    expect(filtrarCatalogo(filas, ' CIMENTACION ')).toEqual([filas[0]]);
    expect(filtrarCatalogo(filas, '')).toHaveLength(2);
    expect(filas).toHaveLength(2);
  });
  it('conserva la partida del material aunque no esté entre las hojas disponibles', () => {
    expect(completarPartidas([], MATERIAL)).toEqual([
      { idCatalogoPartida: 7, codigo: '01', nombre: 'Cimentación (no disponible)' },
    ]);
    expect(
      completarPartidas([{ idCatalogoPartida: 7, codigo: '01', nombre: 'Cimentación' }], MATERIAL),
    ).toHaveLength(1);
  });
  it('valida la respuesta del servicio presupuestario pendiente', () => {
    expect(() =>
      leerOpcionesPartida([{ idCatalogoPartida: '7', codigo: '01', nombre: 'Partida' }]),
    ).toThrow();
    expect(leerOpcionesPartida([])).toEqual([]);
  });
});
