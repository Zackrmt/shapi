const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:03:07',
    timeZone: 'UTC'
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
        element.className = 'settings-status ' + (isError ? 'error' : 'success');
        element.textContent = message;
        setTimeout(() => {
            element.textContent = '';
            element.className = 'settings-status';
        }, 3000);
    }
}

// PIN encryption (using SHA-256)
async function encryptPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    } catch (error) {
        showMessage('settings-status', error.message, true);
    }
}

// Product management
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
        
        monitoredProducts.push({
            id: Date.now(),
            url,
            targetPrice,
            status: 'Active',
            addedAt: new Date().toISOString(),
            addedBy: CONFIG.userLogin
        });

        await chrome.storage.local.set({ monitoredProducts });
        showMessage('status', 'Product added successfully!');
        
        // Clear inputs
        document.getElementById('product-url').value = '';
        document.getElementById('target-price').value = '';
        
        await loadProducts();
    } catch (error) {
        showMessage('status', error.message, true);
    }
}

// Display products
function displayProducts(products) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.innerHTML = '<p>No products monitored yet</p>';
        return;
    }

    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <div>URL: ${product.url}</div>
            <div>Target: ${formatPrice(product.targetPrice)}</div>
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
        showMessage('status', 'Product removed successfully!');
    } catch (error) {
        showMessage('status', 'Failed to remove product', true);
    }
};

// Open dashboard
function openDashboard() {
    chrome.tabs.create({
        url: 'dashboard.html'
    });
}

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substr(0, 19);
    document.getElementById('current-time').textContent = `UTC: ${timeStr}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadProducts();
    
    // Setup event listeners
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('add-button').addEventListener('click', addProduct);
    document.getElementById('open-dashboard').addEventListener('click', openDashboard);
    
    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
});
