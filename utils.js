export const VALID_INSTALLMENT_PERIODS = [1, 3, 6, 12];

export function validateInstallmentPeriod(months) {
  if (!VALID_INSTALLMENT_PERIODS.includes(months)) {
    throw new Error(`Invalid installment period: ${months}. Must be one of ${VALID_INSTALLMENT_PERIODS.join(', ')}`);
  }
  return true;
}

export function validateProductUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('shopee');
  } catch {
    return false;
  }
}

export function validatePrice(price) {
  return !isNaN(price) && price > 0;
}

export function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = isError ? 'error-message' : 'success-message';
  setTimeout(() => {
    element.textContent = '';
  }, 3000);
}
