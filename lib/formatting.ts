// Utilidades de formateo para mostrar datos de forma amigable.

// Convierte fecha de formato ISO (yyyy-mm-dd) a formato chileno (dd/mm/yyyy).
// Si la fecha es inválida o vacía, retorna la cadena original.
export function formatDateDMY(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

// Formatea un número con separadores de miles (ej: 1000000 → 1.000.000).
export function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  return new Intl.NumberFormat('es-CL').format(value);
}
