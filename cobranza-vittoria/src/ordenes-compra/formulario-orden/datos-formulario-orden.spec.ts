import {
  accionesEstado,
  fechaLocalOrden,
  filtrarItemsOrden,
  precioOrden,
  presentarDetalleOrden,
  proveedoresOrden,
  siguienteNumeroOrden,
  subtotalOrden,
  textoTotalOrden,
} from '../datos-orden';
import { detallePrueba, ordenPrueba, requerimientoPrueba } from '../ordenes-compra.fixture';
import {
  controlesItemOrden,
  peticionOrden,
  validarFormularioOrden,
} from './datos-formulario-orden';
import { documentoOrden } from '../documentos-orden/documento-orden';
import { nombrePlanillaOrden, planillaOrden } from '../documentos-orden/planilla-orden';

describe('Datos, cálculos y documentos de órdenes — comportamiento conservado', () => {
  it.each([
    [' registrada ', ['APROBADA', 'ANULADA']],
    ['APROBADA', ['ANULADA']],
    ['ATENDIDA', ['CERRADA']],
    ['ANULADA', []],
    ['CERRADA', []],
    ['DESCONOCIDA', []],
  ])('mantiene las acciones permitidas para %s', (estado, acciones) => {
    expect(accionesEstado({ ...ordenPrueba, estado })).toEqual(acciones);
  });

  it('redondea primero el precio y después cada subtotal, con cero para el precio ausente', () => {
    expect(precioOrden(null)).toBe(0);
    expect(precioOrden(1.005)).toBe(1);
    expect(subtotalOrden(2.5, 1.236)).toBe(3.1);
    expect(textoTotalOrden(ordenPrueba)).toBe('$ 150.00');
    expect(textoTotalOrden({ ...ordenPrueba, total: 0 })).toBe(
      'Sin precio (se define en la Compra)',
    );
    expect(textoTotalOrden({ ...ordenPrueba, simboloMoneda: null })).toBe('USD 150.00');
  });

  it('sugiere el número histórico concatenando sus dígitos y una fecha civil local', () => {
    expect(siguienteNumeroOrden([])).toBe('1');
    expect(
      siguienteNumeroOrden([{ ...ordenPrueba, numeroOrdenCompra: 'OC-2-009' }, ordenPrueba]),
    ).toBe('2010');
    expect(fechaLocalOrden()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('prepara controles sin mutar el requerimiento, valida proveedores y precios', () => {
    const items = requerimientoPrueba.items.map((item) => controlesItemOrden(item).getRawValue());
    expect(items[0]).toEqual(
      expect.objectContaining({ cantidad: 2.5, idProveedor: null, precioUnitario: null }),
    );
    expect(validarFormularioOrden(requerimientoPrueba, items)).toContain(
      'proveedor por cada material',
    );
    expect(
      validarFormularioOrden(requerimientoPrueba, [{ ...items[0], precioUnitario: -1 }]),
    ).toContain('negativo');
    expect(
      validarFormularioOrden(requerimientoPrueba, [{ ...items[0], precioUnitario: Infinity }]),
    ).toContain('válido');
    expect(validarFormularioOrden(requerimientoPrueba, [])).toContain('ítems');

    const dto = peticionOrden(
      requerimientoPrueba,
      ' 9 ',
      '2026-10-20',
      items.map((item) => ({ ...item, idProveedor: 30, precioUnitario: 2.345 })),
    );
    expect(dto.items[0].precioUnitario).toBe(2.35);
    expect(dto.idUsuarioCreacion).toBe(7);
    expect(dto.numeroOrdenCompra).toBe('9');
    expect(requerimientoPrueba.items[0]).not.toHaveProperty('idProveedor');
  });

  it('filtra proveedores recortados, únicos y ordenados, conservando el total general', () => {
    const detalle = presentarDetalleOrden(detallePrueba);
    expect(proveedoresOrden(detalle)).toEqual(['Alfa', 'Beta']);
    expect(filtrarItemsOrden(detalle, 'Beta')).toHaveLength(2);
    expect(filtrarItemsOrden(detalle, 'TODOS')).toHaveLength(3);
    expect(textoTotalOrden(detalle.ordenCompra)).toBe('$ 150.00');
    expect(detalle.items[0].especialidad).toBe('Estructuras');
    expect(detallePrueba.items[0].especialidad).toBeNull();
  });

  it('usa proveedores de cabecera como respaldo según el contrato', () => {
    const detalle = presentarDetalleOrden({
      ...detallePrueba,
      items: [{ ...detallePrueba.items[0], proveedor: null }],
    });
    expect(detalle.items[0].proveedor).toBe('Alfa, Beta');
  });

  it('escapa HTML y exporta únicamente las líneas del filtro sin inventar precios', () => {
    const detalle = presentarDetalleOrden({
      ...detallePrueba,
      ordenCompra: { ...ordenPrueba, nombreProyecto: '<script>obra</script>' },
    });
    const html = documentoOrden(detalle, filtrarItemsOrden(detalle, 'Beta'), 'Beta');
    expect(html).toContain('&lt;script&gt;obra&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Material 0');
    expect(html).not.toContain('Material 1');
    expect(html).toContain('<strong>Proveedor:</strong> Beta');
    expect(html).not.toContain('Precio unit');
  });

  it('mantiene CSV con BOM, separador, escape y extensión XLS histórica', () => {
    const detalle = presentarDetalleOrden({
      ...detallePrueba,
      items: [{ ...detallePrueba.items[0], material: 'Acero; "especial"\n2' }],
    });
    const csv = planillaOrden(detalle, detalle.items, 'Beta');
    expect(csv.startsWith('\ufeffOrden de compra;OC-8\n')).toBe(true);
    expect(csv).toContain('Filtro proveedor;Beta');
    expect(csv).toContain('"Acero; ""especial""\n2"');
    expect(nombrePlanillaOrden('OC/8', 'Beta S.A.')).toBe('oc_OC_8_Beta_S_A_.xls');
  });
});
