export function normalizarTexto(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizarNombreSolicitante(value: string | null | undefined): string {
  const normalized = normalizarTexto(value);

  if (!normalized) return '-';

  if (normalized.includes('administrador')) return 'Administrador';

  if (normalized.includes('contable')) return 'Contable';

  if (normalized.includes('ingeniero')) return 'Ingeniero';

  if (normalized.includes('jefe') && normalized.includes('almacen')) return 'Jefe de Almacen';

  return (
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim() || '-'
  );
}
