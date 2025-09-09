/**
 * Indian Tax Number Validation Utilities
 * Validates PAN, TAN, CIN, and GST numbers according to Indian government formats
 */

// PAN (Permanent Account Number) - Format: AAAAA9999A
// 5 letters + 4 digits + 1 letter
export function validatePAN(pan: string): boolean {
  if (!pan) return true; // Allow empty values
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

// TAN (Tax Deduction Account Number) - Format: AAAA99999A
// 4 letters + 5 digits + 1 letter
export function validateTAN(tan: string): boolean {
  if (!tan) return true; // Allow empty values
  const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
  return tanRegex.test(tan.toUpperCase());
}

// CIN (Corporate Identity Number) - Format: U99999AA9999AAA999999
// U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
export function validateCIN(cin: string): boolean {
  if (!cin) return true; // Allow empty values
  const cinRegex = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
  return cinRegex.test(cin.toUpperCase());
}

// GST (Goods and Services Tax) - Format: 99AAAAA9999A9A9
// 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter + 1 digit
export function validateGST(gst: string): boolean {
  if (!gst) return true; // Allow empty values
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

// Helper function to get validation error message
export function getTaxNumberError(type: 'PAN' | 'TAN' | 'CIN' | 'GST', value: string): string | null {
  if (!value) return null;
  
  switch (type) {
    case 'PAN':
      return validatePAN(value) ? null : 'Invalid PAN format. Format: AAAAA9999A (5 letters + 4 digits + 1 letter)';
    case 'TAN':
      return validateTAN(value) ? null : 'Invalid TAN format. Format: AAAA99999A (4 letters + 5 digits + 1 letter)';
    case 'CIN':
      return validateCIN(value) ? null : 'Invalid CIN format. Format: U99999AA9999AAA999999';
    case 'GST':
      return validateGST(value) ? null : 'Invalid GST format. Format: 99AAAAA9999A9A9';
    default:
      return null;
  }
}

// Format tax numbers to uppercase (common requirement)
export function formatTaxNumber(value: string): string {
  return value ? value.toUpperCase().trim() : '';
}
