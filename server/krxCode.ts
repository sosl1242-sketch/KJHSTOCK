export const KRX_CODE_PATTERN = /^[0-9A-Z]{6}$/;

export function normalizeKrxCode(code: string) {
  return code.trim().toUpperCase();
}

export function isCompleteKrxCode(code: string) {
  return KRX_CODE_PATTERN.test(normalizeKrxCode(code));
}

export function assertCompleteKrxCode(code: string) {
  const normalized = normalizeKrxCode(code);
  if (!KRX_CODE_PATTERN.test(normalized)) {
    throw new Error("KRX stock code must be exactly six uppercase alphanumeric characters.");
  }
  return normalized;
}
