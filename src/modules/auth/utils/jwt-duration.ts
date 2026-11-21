export function parseJwtDuration(value: string): number {
  const normalized = value.trim();
  if (/^\d+$/.test(normalized) && Number(normalized) > 0) {
    const seconds = Number(normalized);
    if (Number.isSafeInteger(seconds)) {
      return seconds;
    }
  }

  const match = normalized.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid JWT duration: ${value}`);
  }

  const amount = Number(match[1]);
  const units: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const seconds = amount * units[match[2]];

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`Invalid JWT duration: ${value}`);
  }

  return seconds;
}
