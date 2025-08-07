const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:41:44',
    timeZone: 'UTC',
    checkInterval: 5000, // Check every 5 seconds
    maxRetries: 3,
    retryDelay: 1000,
    notificationDuration: 5000,
    flashSaleThreshold: 0.2 // 20% price drop threshold
};

// Utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

function truncateUrl(url) {
    const maxLength = 40;
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
}

// Price checking functionality
async function fetchCurrentPrice(url) {
    let retries = 0;
    
    while (retries < CONFIG.maxRetries) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const priceMatch = html.match(/class="product-price"[^>]*>([^<]+)/);
            
            if (priceMatch) {
                const currentPrice = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
                if (!isNaN(currentPrice)) {
                    return currentPrice;
                }
            }
            throw new Error('Price not found');
        } catch (error) {
            console.error(`Attempt ${retries + 1} failed:`, error);
            retries++;
            if (retries < CONFIG.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    }
    
    throw new Error(`Failed to get price after ${CONFIG.maxRetries} attempts`);
}

// Check if price meets buying criteria
async function shouldBuyProduct(product, currentPrice) {
    switch (product.monitorType) {
        case 'strict':
            // Buy only at exact target price
            return currentPrice === product.targetPrice;
            
        case 'below':
            // Buy if price is below threshold
            return currentPrice <= product.belowPrice;
            
        case 'flash':
            // Buy if significant price drop detected
            const priceDropPercentage = (product.originalPrice - currentPrice) / product.originalPrice;
            return priceDropPercentage >= CONFIG.flashSaleThreshold;
            
        default:
            return false;
    }
}

// Update product data
async function updateProductData(product, currentPrice) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const productIndex = monitoredProducts.findIndex(p => p.id === product.id);
        
        if (productIndex !== -1) {
            monitoredProducts[productIndex].currentPrice = currentPrice;
            monitoredProducts[productIndex].lastChecked = new Date().toISOString();
            
            // Update price history
            if (!monitoredProducts[productIndex].priceHistory) {
                monitoredProducts[productIndex].priceHistory = [];
            }
            
            monitoredProducts[productIndex].priceHistory.push({
                price: currentPrice,
                timestamp: new Date().toISOString()
            });

            // Keep only last 100 price points
            if (monitoredProducts[productIndex].priceHistory.length > 100) {
                monitoredProducts[productIndex].priceHistory.shift();
            }

            // Check if should buy
            const shouldBuy = await shouldBuyProduct(monitoredProducts[productIndex], currentPrice);
            
            if (shouldBuy) {
                monitoredProducts[productIndex].status = 'Buying';
                notifyPriceTarget(monitoredProducts[productIndex]);
                initiateAutoBuy(monitoredProducts[productIndex]);
            }

            await chrome.storage.local.set({ monitoredProducts });
        }
    } catch (error) {
        console.error('Failed to update product data:', error);
    }
}

// Notification handlers
function notifyPriceTarget(product) {
    const priceType = (() => {
        switch (product.monitorType) {
            case 'strict': return 'Target';
            case 'below': return 'Below';
            case 'flash': return 'Flash Sale';
        }
    })();

    chrome.notifications.create(`price-alert-${product.id}`, {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: `${priceType} Price Reached! 🎯`,
        message: `${truncateUrl(product.url)}\nCurrent: ${formatPrice(product.currentPrice)}\n${priceType} Price: ${
            product.monitorType === 'flash' 
                ? `${formatPrice(product.originalPrice)} (${Math.round((product.originalPrice - product.currentPrice) / product.originalPrice * 100)}% drop)`
                : formatPrice(product.monitorType === 'strict' ? product.targetPrice : product.belowPrice)
        }`,
        priority: 2
    });
}

function notifyPurchaseSuccess(product) {
    chrome.notifications.create(`purchase-success-${product.id}`, {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Purchase Successful! 🎉',
        message: `Successfully purchased product from ${new URL(product.url).hostname}\nPrice: ${formatPrice(product.currentPrice)}`,
        priority: 2
    });
}

function notifyError(product, error) {
    chrome.notifications.create(`error-${product.id}`, {
        type: 'basic',
        iconUrl: 'images/icon128.png',
        title: 'Monitoring Error ⚠️',
        message: `Error monitoring ${truncateUrl(product.url)}: ${error}`,
        priority: 1
    });
}

// Auto-buy functionality
async function initiateAutoBuy(product) {
    try {
        const { settings } = await chrome.storage.local.get('settings');
        
        // Check if SPaylater should be used
        const useSPaylater = settings?.useSpaylater && settings?.spaylaterPin;
        
        // Send message to content script to handle purchase
        chrome.tabs.create({ url: product.url, active: false }, async (tab) => {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'INITIATE_PURCHASE',
                product,
                settings: {
                    useSPaylater,
                    installmentMonths: settings?.installmentMonths || 6,
                    spaylaterPin: settings?.spaylaterPin
                }
            });
        });
    } catch (error) {
        console.error('Auto-buy initiation failed:', error);
        notifyError(product, 'Failed to initiate purchase');
    }
}

// Main monitoring loop
async function monitorProducts() {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        if (!monitoredProducts) return;

        const activeProducts = monitoredProducts.filter(p => p.status === 'Active');
        
        for (const product of activeProducts) {
            try {
                const currentPrice = await fetchCurrentPrice(product.url);
                await updateProductData(product, currentPrice);
            } catch (error) {
                console.error(`Error monitoring product ${product.id}:`, error);
                notifyError(product, error.message);
            }
        }
    } catch (error) {
        console.error('Monitoring error:', error);
    }
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'PURCHASE_SUCCESS':
            notifyPurchaseSuccess(message.product);
            break;
            
        case 'MONITOR_ERROR':
            notifyError(message.product, message.error);
            break;
            
        case 'START_MONITORING':
            startMonitoring();
            break;
            
        case 'STOP_MONITORING':
            stopMonitoring();
            break;
    }
});

// Monitoring control
let monitoringInterval = null;

function startMonitoring() {
    if (!monitoringInterval) {
        monitoringInterval = setInterval(monitorProducts, CONFIG.checkInterval);
        monitorProducts(); // Initial check
    }
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    // Initialize storage with default settings if not exists
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) {
        await chrome.storage.local.set({
            settings: {
                useSpaylater: true,
                installmentMonths: 6,
                spaylaterPin: null,
                lastUpdated: new Date().toISOString(),
                userLogin: CONFIG.userLogin
            }
        });
    }
    
    // Start monitoring
    startMonitoring();
});

// Restart monitoring when extension is updated or browser is restarted
startMonitoring();
