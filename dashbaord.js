const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:04:07',
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
            <span class="status ${product.status.toLowerCase()}">
                ${product.status}
            </span>
        </div>
        <div>Added: ${new Date(product.addedAt).toLocaleString()}</div>
        <div>URL: <a href="${product.url}" target="_blank">${product.url}</a></div>
        <div class="price-chart" id="chart-${product.id}"></div>
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
        updateStats(0, 0);
        return;
    }

    monitoredProducts.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });

    const activeCount = monitoredProducts.filter(p => p.status === 'Active').length;
    updateStats(monitoredProducts.length, activeCount);
}

// Update statistics
function updateStats(total, active) {
    document.getElementById('total-products').textContent = total;
    document.getElementById('active-monitoring').textContent = active;
    document.getElementById('last-check').textContent = new Date().toLocaleString();
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
    const newProducts = monitoredProducts.filter(p => p.id !== productId);
    await chrome.storage.local.set({ monitoredProducts: newProducts });
    loadProducts();
}

// Load SPaylater settings
async function loadSpaylaterStatus() {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings) {
        document.getElementById('auto-spaylater').checked = settings.useSpaylater;
        document.getElementById('installment-months').value = settings.installmentMonths || '6';
        
        const pinStatus = document.getElementById('pin-status');
        pinStatus.className = `pin-status ${settings.spaylaterPin ? 'set' : 'not-set'}`;
        pinStatus.textContent = settings.spaylaterPin ? 'PIN: Set' : 'PIN: Not Set';
    }
}

// Save settings
async function saveSettings() {
    const useSpaylater = document.getElementById('auto-spaylater').checked;
    const installmentMonths = parseInt(document.getElementById('installment-months').value);

    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
        settings: {
            ...settings,
            useSpaylater,
            installmentMonths,
            lastUpdated: new Date().toISOString()
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data
    await loadProducts();
    await loadSpaylaterStatus();

    // Setup settings listeners
    document.getElementById('auto-spaylater').addEventListener('change', saveSettings);
    document.getElementById('installment-months').addEventListener('change', saveSettings);

    // Start time updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    
    // Refresh products periodically
    setInterval(loadProducts, 5000);
});
