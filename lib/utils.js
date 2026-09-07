export function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.substring(0, 2) === '91') digits = digits.substring(2);
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.substring(1);
  return digits;
}

export function phoneMatches(phone1, phone2) {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  return Boolean(n1 && n2 && n1 === n2);
}

export function sanitizeString(str, maxLength = 500) {
  if (str === null || str === undefined) return '';
  return str.toString().trim().substring(0, maxLength);
}

export function sanitizePhone(phone) {
  if (!phone) return '';
  return phone.toString().replace(/[^0-9+\-\s()]/g, '').substring(0, 20);
}