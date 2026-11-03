import { IMPORT_MODULOS_META } from './metadatos-importacion';

describe('metadata de importación de partidas', () => {
  it('no admite la columna retirada', () => {
    expect(IMPORT_MODULOS_META.partida.columnasOpcionales).toEqual(['CodigoPadre', 'Descripcion']);
    expect(IMPORT_MODULOS_META.partida.columnasOpcionales).not.toContain('Seccion');
  });
});
