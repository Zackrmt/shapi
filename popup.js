// Current configuration
const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 12:43:37',
    timeZone: 'UTC'
};

// Utility functions
function validateInstallmentPeriod(months) {
    const validMonths = [1, 3, 6, 12];
    return validMonths.includes(months);
}

function validateProductUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('shopee');
    } catch {
        return false;
    }
}

function validatePrice(price) {
    return !isNaN(price) && price > 0;
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

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substr(0, 19);
    document.getElementById('current-time').textContent = `UTC: ${timeStr}`;
}

// Main functionality
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadProducts();
    setupEventListeners();
    
    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
});

async function loadSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings) {
        document.getElementById('auto-spaylater').checked = settings.useSpaylater;
        document.getElementById('installment-months').value = settings.installmentMonths || '6';
    }
}

async function loadProducts() {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    displayProducts(monitoredProducts || []);
}

function setupEventListeners() {
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('add-button').addEventListener('click', addProduct);
}

async function saveSettings() {
    const useSpaylater = document.getElementById('auto-spaylater').checked;
    const installmentMonths = parseInt(document.getElementById('installment-months').value);

    try {
        if (!validateInstallmentPeriod(installmentMonths)) {
            throw new Error('Invalid installment period');
        }
        
        await chrome.storage.local.set({
            settings: {
                useSpaylater,
                installmentMonths,
                lastUpdated: new Date().toISOString(),
                userLogin: CONFIG.userLogin
            }
        });

        showMessage('settings-status', 'Settings saved successfully!');
    } catch (error) {
        showMessage('settings-status', error.message, true);
    }
}

async function addProduct() {
    const url = document.getElementById('product-url').value.trim();
    const targetPrice = parseFloat(document.getElementById('target-price').value);

    try {
        if (!validateProductUrl(url)) {
            throw new Error('Invalid Shopee product URL');
        }
        if (!validatePrice(targetPrice)) {
            throw new Error('Invalid price');
        }

        const { monitoredProducts = [] } = await chrome.storage.local.get('monitoredProducts');
        
        monitoredProducts.push({
            url,
            targetPrice,
            addedAt: new Date().toISOString(),
            addedBy: CONFIG.userLogin
        });

        await chrome.storage.local.set({ monitoredProducts });
        showMessage('status', 'Product added successfully!');
        displayProducts(monitoredProducts);
        
        // Clear inputs
        document.getElementById('product-url').value = '';
        document.getElementById('target-price').value = '';
        
    } catch (error) {
        showMessage('status', error.message, true);
    }
}

function displayProducts(products) {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p>No products monitored yet</p>';
        return;
    }

    products.forEach((product, index) => {
        const div = document.createElement('div');
        div.className = 'product-item';
        div.innerHTML = `
            <div>URL: ${product.url}</div>
            <div>Target Price: ${formatPrice(product.targetPrice)}</div>
            <div>Added: ${new Date(product.addedAt).toLocaleString()}</div>
            <div>By: ${product.addedBy || CONFIG.userLogin}</div>
            <button class="button" onclick="removeProduct(${index})">Remove</button>
        `;
        container.appendChild(div);
    });
}

window.removeProduct = async function(index) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        monitoredProducts.splice(index, 1);
        await chrome.storage.local.set({ monitoredProducts });
        displayProducts(monitoredProducts);
        showMessage('status', 'Product removed successfully!');
    } catch (error) {
        showMessage('status', 'Failed to remove product', true);
    }
};