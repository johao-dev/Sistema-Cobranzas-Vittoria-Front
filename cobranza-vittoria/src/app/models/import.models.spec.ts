import { IMPORT_MODULOS_META } from './import.models';

describe('metadata de importación de partidas', () => {
  it('no admite la columna retirada', () => {
    expect(IMPORT_MODULOS_META.partida.columnasOpcionales).toEqual(['CodigoPadre', 'Descripcion']);
    expect(IMPORT_MODULOS_META.partida.columnasOpcionales).not.toContain('Seccion');
  });
});
