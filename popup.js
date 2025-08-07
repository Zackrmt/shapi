const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:40:04',
    timeZone: 'UTC',
    flashSaleThreshold: 0.2 // 20% price drop threshold for flash sales
};

// Utility functions
function validatePin(pin) {
    return /^\d{6}$/.test(pin);
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.className = 'status-message ' + (isError ? 'error' : 'success');
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
            element.className = 'status-message';
        }, 3000);
    }
}

function truncateUrl(url) {
    const maxLength = 40;
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
}

// PIN encryption
async function encryptPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Price input visibility
function updatePriceInputs() {
    const monitorType = document.getElementById('price-monitor-type').value;
    document.getElementById('strict-price-input').style.display = 
        monitorType === 'strict' ? 'block' : 'none';
    document.getElementById('below-price-input').style.display = 
        monitorType === 'below' ? 'block' : 'none';
    document.getElementById('flash-sale-input').style.display = 
        monitorType === 'flash' ? 'block' : 'none';
}

// Load settings
async function loadSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings) {
        document.getElementById('auto-spaylater').checked = settings.useSpaylater;
        document.getElementById('installment-months').value = settings.installmentMonths || '6';
        if (settings.spaylaterPin) {
            document.getElementById('spaylater-pin').placeholder = '(PIN Set)';
        }
    }
}

// Save settings
async function saveSettings() {
    const useSpaylater = document.getElementById('auto-spaylater').checked;
    const installmentMonths = parseInt(document.getElementById('installment-months').value);
    const spaylaterPin = document.getElementById('spaylater-pin').value;

    try {
        if (useSpaylater && spaylaterPin && !validatePin(spaylaterPin)) {
            throw new Error('PIN must be 6 digits');
        }

        const encryptedPin = spaylaterPin ? await encryptPin(spaylaterPin) : null;
        
        await chrome.storage.local.set({
            settings: {
                useSpaylater,
                installmentMonths,
                spaylaterPin: encryptedPin || (await chrome.storage.local.get('settings')).settings?.spaylaterPin,
                lastUpdated: new Date().toISOString(),
                userLogin: CONFIG.userLogin
            }
        });

        showMessage('settings-status', 'Settings saved successfully!');
        document.getElementById('spaylater-pin').value = '';
        document.getElementById('spaylater-pin').placeholder = '(PIN Set)';
    } catch (error) {
        showMessage('settings-status', error.message, true);
    }
}

// Add product
async function addProduct() {
    const url = document.getElementById('product-url').value.trim();
    const monitorType = document.getElementById('price-monitor-type').value;
    let targetPrice, belowPrice, originalPrice;

    try {
        if (!url.includes('shopee.')) {
            throw new Error('Invalid Shopee URL');
        }

        switch (monitorType) {
            case 'strict':
                targetPrice = parseFloat(document.getElementById('target-price').value);
                if (isNaN(targetPrice) || targetPrice <= 0) {
                    throw new Error('Invalid target price');
                }
                break;

            case 'below':
                belowPrice = parseFloat(document.getElementById('below-target-price').value);
                if (isNaN(belowPrice) || belowPrice <= 0) {
                    throw new Error('Invalid price threshold');
                }
                break;

            case 'flash':
                originalPrice = parseFloat(document.getElementById('original-price').value);
                if (isNaN(originalPrice) || originalPrice <= 0) {
                    throw new Error('Invalid original price');
                }
                break;
        }

        const { monitoredProducts = [] } = await chrome.storage.local.get('monitoredProducts');
        
        monitoredProducts.push({
            id: Date.now(),
            url,
            monitorType,
            targetPrice: targetPrice || null,
            belowPrice: belowPrice || null,
            originalPrice: originalPrice || null,
            status: 'Active',
            addedAt: new Date().toISOString(),
            addedBy: CONFIG.userLogin,
            currentPrice: null,
            lastChecked: null,
            priceHistory: []
        });

        await chrome.storage.local.set({ monitoredProducts });
        showMessage('add-status', 'Product added successfully!');
        
        // Clear inputs
        document.getElementById('product-url').value = '';
        document.getElementById('target-price').value = '';
        document.getElementById('below-target-price').value = '';
        document.getElementById('original-price').value = '';
        
        await loadProducts();
    } catch (error) {
        showMessage('add-status', error.message, true);
    }
}

// Display products
function displayProducts(products) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<div class="product-item">No products monitored yet</div>';
        return;
    }

    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        
        const priceDisplay = (() => {
            switch (product.monitorType) {
                case 'strict':
                    return `Target: ${formatPrice(product.targetPrice)}`;
                case 'below':
                    return `Below: ${formatPrice(product.belowPrice)}`;
                case 'flash':
                    return `Original: ${formatPrice(product.originalPrice)}`;
                default:
                    return 'Price not set';
            }
        })();

        div.innerHTML = `
            <div>URL: ${truncateUrl(product.url)}</div>
            <div class="price">
                ${priceDisplay}
                ${product.currentPrice ? ` | Current: ${formatPrice(product.currentPrice)}` : ''}
            </div>
            <div>Type: ${product.monitorType}</div>
            <div>Status: ${product.status}</div>
            <button onclick="removeProduct(${product.id})" style="background: #dc3545;">
                Remove
            </button>
        `;
        container.appendChild(div);
    });
}

// Load products
async function loadProducts() {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    displayProducts(monitoredProducts);
}

// Remove product
window.removeProduct = async function(productId) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const newProducts = monitoredProducts.filter(p => p.id !== productId);
        await chrome.storage.local.set({ monitoredProducts: newProducts });
        await loadProducts();
        showMessage('add-status', 'Product removed successfully!');
    } catch (error) {
        showMessage('add-status', 'Failed to remove product', true);
    }
};

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substr(0, 19);
    document.getElementById('current-time').textContent = `${CONFIG.timeZone}: ${timeStr}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadProducts();
    
    // Setup event listeners
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('add-product').addEventListener('click', addProduct);
    document.getElementById('price-monitor-type').addEventListener('change', updatePriceInputs);
    document.getElementById('open-dashboard').addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });
    
    // Setup URL input listener for flash sale price fetching
    document.getElementById('product-url').addEventListener('blur', async () => {
        const url = document.getElementById('product-url').value.trim();
        const monitorType = document.getElementById('price-monitor-type').value;
        
        if (monitorType === 'flash' && url.includes('shopee.')) {
            try {
                const response = await fetch(url);
                const html = await response.text();
                const priceMatch = html.match(/class="product-price"[^>]*>([^<]+)/);
                
                if (priceMatch) {
                    const currentPrice = parseFloat(priceMatch[1].replace(/[^0-9.]/g, ''));
                    document.getElementById('original-price').value = currentPrice;
                }
            } catch (error) {
                console.error('Failed to fetch original price:', error);
            }
        }
    });
    
    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
});
