/** Utilidades de dinero: todos los montos se guardan en centavos (enteros). */

export function parseAmountToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let raw = String(input).trim().replace(/\s/g, '').replace(/\$/g, '').replace(/usd/gi, '');
  if (!raw) return null;

  if (raw.includes(',') && raw.includes('.')) {
    raw =
      raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const value = Math.round(Number(raw) * 100);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function formatMoney(cents: number, symbol = '$'): string {
  const rounded = Math.round(Number(cents) || 0);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100).toLocaleString('es-CL');
  const decimals = abs % 100;
  const tail = decimals === 0 ? '' : `,${String(decimals).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${symbol} ${whole}${tail}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}
