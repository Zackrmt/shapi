import { CONFIG, PinManager, PriceManager, DOMUtils, StorageManager, DebugUtils } from './utils.js';

class ShopeeBot {
    constructor() {
        this.config = {
            userLogin: 'Zackrmt',
            startTime: '2025-08-07 13:10:02',
            timeZone: 'UTC',
            selectors: {
                price: '.product-price',
                buyNow: '.buy-now-button',
                checkout: '.checkout-button',
                spaylater: '.spaylater-option',
                pinInput: 'input[type="tel"][maxlength="6"]',
                installmentSelect: '.installment-select',
                confirmButton: 'button[type="submit"]'
            }
        };
        this.initialize();
    }

    async initialize() {
        try {
            await this.setupObservers();
            await this.startPriceMonitoring();
            DebugUtils.log('ShopeeBot initialized');
        } catch (error) {
            DebugUtils.error('Initialization error:', error);
        }
    }

    async setupObservers() {
        // Observer for SPaylater verification popup
        const spaylaterObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    const pinPopup = document.querySelector('.spaylater-verification-popup');
                    if (pinPopup) {
                        this.handleSpaylaterVerification();
                    }
                }
            }
        });

        spaylaterObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async handleSpaylaterVerification() {
        try {
            const settings = await StorageManager.getSettings();
            if (!settings?.spaylaterPin) {
                DebugUtils.log('SPaylater PIN not set');
                return;
            }

            const pinInput = await DOMUtils.waitForElement(this.config.selectors.pinInput);
            if (pinInput) {
                // Simulate human-like typing
                const pin = settings.spaylaterPin.slice(-6);
                for (let digit of pin) {
                    pinInput.value += digit;
                    pinInput.dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
                }

                const confirmButton = await DOMUtils.waitForElement(this.config.selectors.confirmButton);
                if (confirmButton) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    confirmButton.click();
                }
            }
        } catch (error) {
            DebugUtils.error('SPaylater verification error:', error);
        }
    }

    async getCurrentPrice() {
        const priceElement = await DOMUtils.waitForElement(this.config.selectors.price);
        if (priceElement) {
            return PriceManager.parse(priceElement.textContent);
        }
        return null;
    }

    async autoBuy(targetPrice) {
        try {
            const currentPrice = await this.getCurrentPrice();
            if (!currentPrice || currentPrice > targetPrice) {
                return false;
            }

            // Click buy now button
            const buyButton = await DOMUtils.waitForElement(this.config.selectors.buyNow);
            if (!buyButton) return false;
            buyButton.click();

            // Wait for checkout page
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Handle SPaylater if enabled
            const settings = await StorageManager.getSettings();
            if (settings?.useSpaylater) {
                const spaylaterOption = await DOMUtils.waitForElement(this.config.selectors.spaylater);
                if (spaylaterOption) {
                    spaylaterOption.click();
                    
                    const periodSelect = await DOMUtils.waitForElement(this.config.selectors.installmentSelect);
                    if (periodSelect) {
                        periodSelect.value = settings.installmentMonths;
                        periodSelect.dispatchEvent(new Event('change'));
                    }
                }
            }

            // Click checkout button
            const checkoutButton = await DOMUtils.waitForElement(this.config.selectors.checkout);
            if (checkoutButton) {
                checkoutButton.click();
                return true;
            }

            return false;
        } catch (error) {
            DebugUtils.error('Auto-buy error:', error);
            return false;
        }
    }

    async startPriceMonitoring() {
        setInterval(async () => {
            try {
                const currentUrl = window.location.href;
                if (!currentUrl.includes('shopee.')) return;

                const currentPrice = await this.getCurrentPrice();
                if (!currentPrice) return;

                const products = await StorageManager.getMonitoredProducts();
                const matchingProduct = products.find(p => p.url === currentUrl && p.status === 'Active');

                if (matchingProduct) {
                    // Update current price
                    matchingProduct.currentPrice = currentPrice;
                    matchingProduct.lastChecked = new Date().toISOString();

                    // Check if target price reached
                    if (currentPrice <= matchingProduct.targetPrice) {
                        const success = await this.autoBuy(matchingProduct.targetPrice);
                        if (success) {
                            matchingProduct.status = 'Purchased';
                            chrome.runtime.sendMessage({
                                type: 'PURCHASE_SUCCESS',
                                product: matchingProduct
                            });
                        }
                    }

                    await StorageManager.saveMonitoredProducts(products);
                }
            } catch (error) {
                DebugUtils.error('Price monitoring error:', error);
            }
        }, CONFIG.checkInterval);
    }
}

// Initialize bot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ShopeeBot();
});
