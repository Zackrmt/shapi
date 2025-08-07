const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:05:12',
    timeZone: 'UTC',
    checkInterval: 5000 // Check every 5 seconds
};

// Handle purchase success
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PURCHASE_SUCCESS') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Purchase Success!',
            message: `Successfully purchased product from ${new URL(message.product.url).hostname} at ${formatPrice(message.product.currentPrice)}`
        });
    }
});

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// Check prices in background
async function checkPrices() {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    if (!monitoredProducts) return;

    const activeProducts = monitoredProducts.filter(p => p.status === 'Active');
    
    for (const product of activeProducts) {
        try {
            const response = await fetch(product.url);
            const html = await response.text();
            
            // Simple price extraction (you might need to adjust this based on Shopee's HTML structure)
            const priceMatch = html.match(/class="product-price"[^>]*>([^<]+)/);
            if (priceMatch) {
                const currentPrice = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
                if (!isNaN(currentPrice)) {
                    product.currentPrice = currentPrice;
                    product.lastChecked = new Date().toISOString();

                    // Notify if price reaches target
                    if (currentPrice <= product.targetPrice) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'images/icon128.png',
                            title: 'Price Alert!',
                            message: `Target price reached for product! Current: ${formatPrice(currentPrice)}, Target: ${formatPrice(product.targetPrice)}`
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error checking price:', error);
        }
    }

    // Save updated prices
    await chrome.storage.local.set({ monitoredProducts });
}

// Start background monitoring
setInterval(checkPrices, CONFIG.checkInterval);

// Handle installation
chrome.runtime.onInstalled.addListener(async () => {
    // Initialize storage with default settings
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
});
