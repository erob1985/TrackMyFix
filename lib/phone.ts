function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function getUsPhoneDigits(value: string): string {
  return digitsOnly(value).slice(0, 10);
}

export function formatUsPhone(value: string): string {
  const digits = getUsPhoneDigits(value);
  if (digits.length === 0) {
    return "";
  }

  const area = digits.slice(0, 3);
  const mid = digits.slice(3, 6);
  const last = digits.slice(6, 10);

  if (digits.length <= 3) {
    return area;
  }

  if (digits.length <= 6) {
    return `(${area}) ${mid}`;
  }

  return `(${area}) ${mid}-${last}`;
}

export function isValidUsPhone(value: string): boolean {
  return getUsPhoneDigits(value).length === 10;
}

