const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 12:53:47',
    timeZone: 'UTC'
};

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substr(0, 19);
    document.getElementById('current-time').textContent = `UTC: ${timeStr}`;
}

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

// Create product card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        <h3>Product ${product.id}</h3>
        <div class="price-info">
            <div>
                <div>Current: ${formatPrice(product.currentPrice || 0)}</div>
                <div>Target: ${formatPrice(product.targetPrice)}</div>
            </div>
            <span class="status ${product.status === 'Active' ? 'active' : 'waiting'}">
                ${product.status}
            </span>
        </div>
        <div>Added: ${new Date(product.addedAt).toLocaleString()}</div>
        <div>URL: <a href="${product.url}" target="_blank">${product.url}</a></div>
        <div class="controls">
            <button onclick="toggleMonitoring(${product.id})">
                ${product.status === 'Active' ? 'Pause' : 'Start'} Monitoring
            </button>
            <button onclick="removeProduct(${product.id})" style="background: #dc3545;">
                Remove
            </button>
        </div>
    `;
    return card;
}

// Load and display products
async function loadProducts() {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    if (!monitoredProducts || monitoredProducts.length === 0) {
        grid.innerHTML = '<div class="product-card">No products monitored yet</div>';
        return;
    }

    monitoredProducts.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

// Toggle product monitoring
async function toggleMonitoring(productId) {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    const product = monitoredProducts.find(p => p.id === productId);
    if (product) {
        product.status = product.status === 'Active' ? 'Waiting' : 'Active';
        await chrome.storage.local.set({ monitoredProducts });
        loadProducts();
    }
}

// Remove product
async function removeProduct(productId) {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    const index = monitoredProducts.findIndex(p => p.id === productId);
    if (index !== -1) {
        monitoredProducts.splice(index, 1);
        await chrome.storage.local.set({ monitoredProducts });
        loadProducts();
    }
}

// Save settings
async function saveSettings() {
    const useSpaylater = document.getElementById('auto-spaylater').checked;
    const installmentMonths = parseInt(document.getElementById('installment-months').value);

    await chrome.storage.local.set({
        settings: {
            useSpaylater,
            installmentMonths,
            lastUpdated: new Date().toISOString(),
            userLogin: CONFIG.userLogin
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);

    // Load initial data
    await loadProducts();

    // Setup settings listeners
    document.getElementById('auto-spaylater').addEventListener('change', saveSettings);
    document.getElementById('installment-months').addEventListener('change', saveSettings);

    // Load settings
    const { settings } = await chrome.storage.local.get('settings');
    if (settings) {
        document.getElementById('auto-spaylater').checked = settings.useSpaylater;
        document.getElementById('installment-months').value = settings.installmentMonths || '6';
    }
});

// Add monitoring refresh
setInterval(loadProducts, 5000); // Refresh every 5 seconds
