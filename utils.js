// Global configuration
const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:09:09',
    timeZone: 'UTC',
    debug: true,
    checkInterval: 5000
};

// PIN handling
class PinManager {
    static async encrypt(pin) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(pin);
            const buffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(buffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('PIN encryption error:', error);
            return null;
        }
    }

    static validate(pin) {
        return /^\d{6}$/.test(pin);
    }

    static async verify(inputPin, storedHash) {
        const inputHash = await this.encrypt(inputPin);
        return inputHash === storedHash;
    }
}

// Price handling
class PriceManager {
    static format(price) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    }

    static parse(priceString) {
        return parseFloat(priceString.replace(/[^0-9.]/g, ''));
    }

    static compare(price1, price2) {
        return Math.abs(price1 - price2) < 0.01;
    }
}

// DOM utilities
class DOMUtils {
    static async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return null;
    }

    static showMessage(elementId, message, isError = false) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `status-message ${isError ? 'error' : 'success'}`;
            element.textContent = message;
            setTimeout(() => {
                element.textContent = '';
                element.className = 'status-message';
            }, 3000);
        }
    }

    static updateTimeDisplay(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const now = new Date();
            const timeStr = now.toISOString().replace('T', ' ').substr(0, 19);
            element.textContent = `${CONFIG.timeZone}: ${timeStr}`;
        }
    }
}

// Storage management
class StorageManager {
    static async getSettings() {
        const { settings } = await chrome.storage.local.get('settings');
        return settings || {
            useSpaylater: true,
            installmentMonths: 6,
            spaylaterPin: null,
            lastUpdated: new Date().toISOString(),
            userLogin: CONFIG.userLogin
        };
    }

    static async saveSettings(settings) {
        await chrome.storage.local.set({
            settings: {
                ...settings,
                lastUpdated: new Date().toISOString()
            }
        });
    }

    static async getMonitoredProducts() {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        return monitoredProducts || [];
    }

    static async saveMonitoredProducts(products) {
        await chrome.storage.local.set({ monitoredProducts: products });
    }
}

// Debug utilities
class DebugUtils {
    static log(...args) {
        if (CONFIG.debug) {
            console.log(`[${new Date().toISOString()}]`, ...args);
        }
    }

    static error(...args) {
        if (CONFIG.debug) {
            console.error(`[${new Date().toISOString()}]`, ...args);
        }
    }
}

// Export utilities
export {
    CONFIG,
    PinManager,
    PriceManager,
    DOMUtils,
    StorageManager,
    DebugUtils
};
