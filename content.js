const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:05:12',
    timeZone: 'UTC'
};

// Utility functions
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return null;
}

async function getCurrentPrice() {
    const priceElement = await waitForElement('.product-price');
    if (priceElement) {
        const price = parseFloat(priceElement.textContent.replace(/[^0-9.]/g, ''));
        return isNaN(price) ? null : price;
    }
    return null;
}

// Handle SPaylater verification
async function handleSpaylaterVerification() {
    try {
        const { settings } = await chrome.storage.local.get('settings');
        if (!settings?.spaylaterPin) {
            console.log('SPaylater PIN not set');
            return;
        }

        const pinInput = await waitForElement('input[type="tel"][maxlength="6"]');
        if (pinInput) {
            // Get the encrypted PIN
            const encryptedPin = settings.spaylaterPin;
            // Decrypt PIN (simplified for example)
            const pin = encryptedPin.slice(-6);
            
            // Simulate human-like typing
            for (let digit of pin) {
                pinInput.value += digit;
                pinInput.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            }

            // Find and click confirm button
            const confirmButton = await waitForElement('button[type="submit"]');
            if (confirmButton) {
                await new Promise(resolve => setTimeout(resolve, 500));
                confirmButton.click();
            }
        }
    } catch (error) {
        console.error('Error handling SPaylater verification:', error);
    }
}

// Auto-buy functionality
async function autoBuy(targetPrice) {
    try {
        // Check current price
        const currentPrice = await getCurrentPrice();
        if (!currentPrice || currentPrice > targetPrice) {
            return false;
        }

        // Click buy now button
        const buyButton = await waitForElement('.buy-now-button');
        if (!buyButton) return false;
        buyButton.click();

        // Wait for checkout page
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle SPaylater if enabled
        const { settings } = await chrome.storage.local.get('settings');
        if (settings?.useSpaylater) {
            const spaylaterOption = await waitForElement('.spaylater-option');
            if (spaylaterOption) {
                spaylaterOption.click();
                
                // Select installment period
                const periodSelect = await waitForElement('.installment-select');
                if (periodSelect) {
                    periodSelect.value = settings.installmentMonths;
                    periodSelect.dispatchEvent(new Event('change'));
                }
            }
        }

        // Click checkout button
        const checkoutButton = await waitForElement('.checkout-button');
        if (checkoutButton) {
            checkoutButton.click();
            return true;
        }

        return false;
    } catch (error) {
        console.error('Auto-buy error:', error);
        return false;
    }
}

// Monitor price changes
async function monitorPrice() {
    const currentUrl = window.location.href;
    if (!currentUrl.includes('shopee.')) return;

    const currentPrice = await getCurrentPrice();
    if (!currentPrice) return;

    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    if (!monitoredProducts) return;

    const matchingProduct = monitoredProducts.find(p => p.url === currentUrl && p.status === 'Active');
    if (matchingProduct) {
        // Update current price
        matchingProduct.currentPrice = currentPrice;
        matchingProduct.lastChecked = new Date().toISOString();

        // Check if target price reached
        if (currentPrice <= matchingProduct.targetPrice) {
            const success = await autoBuy(matchingProduct.targetPrice);
            if (success) {
                matchingProduct.status = 'Purchased';
                chrome.runtime.sendMessage({
                    type: 'PURCHASE_SUCCESS',
                    product: matchingProduct
                });
            }
        }

        // Save updated product data
        await chrome.storage.local.set({ monitoredProducts });
    }
}

// Setup observers
const setupObservers = () => {
    // Observer for SPaylater verification popup
    const spaylaterObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const pinPopup = document.querySelector('.spaylater-verification-popup');
                if (pinPopup) {
                    handleSpaylaterVerification();
                }
            }
        }
    });

    spaylaterObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Price monitoring
    setInterval(monitorPrice, 1000);
};

// Initialize
document.addEventListener('DOMContentLoaded', setupObservers);
