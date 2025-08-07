const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:43:40',
    timeZone: 'UTC',
    checkInterval: 5000, // Regular check interval
    flashSaleCheckInterval: 1000, // Check more frequently during flash sale
    preFlashSaleBuffer: 30000, // Start intensive monitoring 30s before flash sale
    flashSaleRefreshInterval: 500, // Refresh rate during flash sale countdown
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

// Flash sale timing detection
async function getFlashSaleInfo(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Look for flash sale timing indicators
        const flashSaleMatch = html.match(/data-flash-sale-time="([^"]+)"/);
        const startTimeMatch = html.match(/data-start-time="([^"]+)"/);
        const endTimeMatch = html.match(/data-end-time="([^"]+)"/);
        const flashPriceMatch = html.match(/data-flash-sale-price="([^"]+)"/);

        if (flashSaleMatch || (startTimeMatch && endTimeMatch)) {
            return {
                isFlashSale: true,
                startTime: startTimeMatch ? new Date(startTimeMatch[1]) : null,
                endTime: endTimeMatch ? new Date(endTimeMatch[1]) : null,
                timestamp: flashSaleMatch ? parseInt(flashSaleMatch[1]) : null,
                flashPrice: flashPriceMatch ? parseFloat(flashPriceMatch[1]) : null
            };
        }

        return { isFlashSale: false };
    } catch (error) {
        console.error('Failed to get flash sale info:', error);
        return { isFlashSale: false };
    }
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
            return currentPrice === product.targetPrice;
            
        case 'below':
            return currentPrice <= product.belowPrice;
            
        case 'flash':
            if (product.flashSaleInfo?.isFlashSale) {
                const now = new Date();
                const startTime = new Date(product.flashSaleInfo.startTime);
                const endTime = new Date(product.flashSaleInfo.endTime);
                
                if (now >= startTime && now <= endTime) {
                    const priceDropPercentage = (product.originalPrice - currentPrice) / product.originalPrice;
                    return priceDropPercentage >= CONFIG.flashSaleThreshold;
                }
            }
            return false;
            
        default:
            return false;
    }
}

// Prepare for flash sale
async function prepareForFlashSale(product) {
    try {
        const timeUntilStart = new Date(product.flashSaleInfo.startTime) - new Date();
        
        // Create countdown notification
        chrome.notifications.create(`flash-sale-countdown-${product.id}`, {
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Flash Sale Starting Soon! ⚡',
            message: `Preparing to buy: ${truncateUrl(product.url)}\nStarting in: ${Math.ceil(timeUntilStart / 1000)} seconds`,
            priority: 2
        });

        // Pre-load page and prepare for purchase
        chrome.tabs.create(
            { 
                url: product.url, 
                active: false 
            }, 
            async (tab) => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'PREPARE_FLASH_SALE',
                    product: product,
                    startTime: product.flashSaleInfo.startTime
                });
            }
        );
    } catch (error) {
        console.error('Failed to prepare for flash sale:', error);
        notifyError(product, 'Failed to prepare for flash sale');
    }
}

// Update product data
async function updateProductData(product, currentPrice) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const productIndex = monitoredProducts.findIndex(p => p.id === product.id);
        
        if (productIndex !== -1) {
            // Update flash sale info if needed
            if (product.monitorType === 'flash') {
                const flashSaleInfo = await getFlashSaleInfo(product.url);
                monitoredProducts[productIndex].flashSaleInfo = flashSaleInfo;
                
                if (flashSaleInfo.isFlashSale) {
                    const now = new Date();
                    const startTime = new Date(flashSaleInfo.startTime);
                    const timeUntilStart = startTime - now;

                    if (timeUntilStart > 0 && timeUntilStart <= CONFIG.preFlashSaleBuffer) {
                        monitoredProducts[productIndex].monitoringInterval = CONFIG.flashSaleRefreshInterval;
                        prepareForFlashSale(monitoredProducts[productIndex]);
                    }
                }
            }

            // Update price and history
            monitoredProducts[productIndex].currentPrice = currentPrice;
            monitoredProducts[productIndex].lastChecked = new Date().toISOString();
            
            if (!monitoredProducts[productIndex].priceHistory) {
                monitoredProducts[productIndex].priceHistory = [];
            }
            
            monitoredProducts[productIndex].priceHistory.push({
                price: currentPrice,
                timestamp: new Date().toISOString()
            });

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
        notifyError(product, 'Failed to update product data');
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
        const useSPaylater = settings?.useSpaylater && settings?.spaylaterPin;
        
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
                // Determine check interval based on product type and flash sale status
                const checkInterval = product.monitorType === 'flash' && 
                                    product.flashSaleInfo?.isFlashSale ? 
                                    CONFIG.flashSaleCheckInterval : 
                                    CONFIG.checkInterval;

                // Check if enough time has passed since last check
                const now = new Date();
                const lastCheck = new Date(product.lastChecked || 0);
                if (now - lastCheck < checkInterval) continue;

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
