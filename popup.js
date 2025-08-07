const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:21:16',
    timeZone: 'UTC'
};

// Utility functions (keep your existing ones)
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
        element.className = 'settings-status ' + (isError ? 'error' : 'success');
        element.textContent = message;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'settings-status';
        }, 3000);
    }
}

// Add this new utility function for URL truncation
function truncateUrl(url) {
    const maxLength = 40;
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
}

// Keep your existing PIN encryption
async function encryptPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Enhanced loadSettings with SPaylater options visibility
async function loadSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings) {
        const autoSpaylater = document.getElementById('auto-spaylater');
        const spaylaterOptions = document.querySelector('.spaylater-options');
        
        autoSpaylater.checked = settings.useSpaylater;
        document.getElementById('installment-months').value = settings.installmentMonths || '6';
        
        if (settings.spaylaterPin) {
            document.getElementById('spaylater-pin').placeholder = '(PIN Set)';
        }

        // Toggle SPaylater options visibility
        if (spaylaterOptions) {
            spaylaterOptions.style.display = settings.useSpaylater ? 'block' : 'none';
        }
    }
}

// Keep your existing saveSettings function

// Enhanced addProduct with price validation
async function addProduct() {
    const url = document.getElementById('product-url').value.trim();
    const targetPrice = parseFloat(document.getElementById('target-price').value);

    try {
        if (!url.includes('shopee.')) {
            throw new Error('Invalid Shopee URL');
        }
        if (isNaN(targetPrice) || targetPrice <= 0) {
            throw new Error('Invalid price');
        }

        const { monitoredProducts = [] } = await chrome.storage.local.get('monitoredProducts');
        
        const newProduct = {
            id: Date.now(),
            url,
            targetPrice,
            status: 'Active',
            addedAt: new Date().toISOString(),
            addedBy: CONFIG.userLogin,
            currentPrice: null,
            lastChecked: null,
            priceHistory: []
        };

        monitoredProducts.push(newProduct);
        await chrome.storage.local.set({ monitoredProducts });
        showMessage('add-status', 'Product added successfully!');
        
        // Clear inputs
        document.getElementById('product-url').value = '';
        document.getElementById('target-price').value = '';
        
        await loadProducts();
    } catch (error) {
        showMessage('add-status', error.message, true);
    }
}

// Enhanced displayProducts with price history
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
        div.innerHTML = `
            <div>URL: ${truncateUrl(product.url)}</div>
            <div class="price">
                Target: ${formatPrice(product.targetPrice)}
                ${product.currentPrice ? ` | Current: ${formatPrice(product.currentPrice)}` : ''}
            </div>
            <div>Status: ${product.status}</div>
            <div>Last Checked: ${product.lastChecked ? new Date(product.lastChecked).toLocaleString() : 'Never'}</div>
            <button onclick="removeProduct(${product.id})" style="background: #dc3545;">
                Remove
            </button>
        `;
        container.appendChild(div);
    });
}

// Keep your existing loadProducts, removeProduct, and openDashboard functions

// Enhanced initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadProducts();
    
    // Setup event listeners
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('add-product').addEventListener('click', addProduct);
    document.getElementById('open-dashboard').addEventListener('click', openDashboard);
    
    // Add SPaylater toggle listener
    document.getElementById('auto-spaylater').addEventListener('change', (e) => {
        const options = document.querySelector('.spaylater-options');
        if (options) {
            options.style.display = e.target.checked ? 'block' : 'none';
        }
    });
    
    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
});
