const CONFIG = {
    userLogin: 'Zackrmt',
    startTime: '2025-08-07 13:23:50',
    timeZone: 'UTC',
    refreshInterval: 5000, // Refresh every 5 seconds
    chartUpdateInterval: 30000 // Update charts every 30 seconds
};

// Utility functions
function formatDateTime(date) {
    return new Date(date).toISOString().replace('T', ' ').substr(0, 19);
}

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

// Update time display
function updateTimeDisplay() {
    const now = new Date();
    const timeStr = formatDateTime(now);
    document.getElementById('current-time').textContent = `${CONFIG.timeZone}: ${timeStr}`;
    document.getElementById('update-time').textContent = timeStr;
}

// Load and display settings
async function loadSettings() {
    try {
        const { settings } = await chrome.storage.local.get('settings');
        if (settings) {
            document.getElementById('spaylater-status').innerHTML = `
                <div class="status-badge ${settings.useSpaylater ? 'status-active' : 'status-waiting'}">
                    ${settings.useSpaylater ? 'Enabled' : 'Disabled'}
                </div>
                ${settings.spaylaterPin ? '<div style="margin-top:5px">PIN: Set</div>' : ''}
            `;

            document.getElementById('installment-period').textContent = 
                `${settings.installmentMonths || 6} Months`;

            document.getElementById('last-updated').textContent = 
                formatDateTime(settings.lastUpdated || CONFIG.startTime);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Create product card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const statusClass = 
        product.status === 'Active' ? 'status-active' : 
        product.status === 'Error' ? 'status-error' : 'status-waiting';

    card.innerHTML = `
        <h3>${truncateUrl(product.url)}</h3>
        <div class="price-info">
            <div>
                <div class="current-price">
                    Current: ${product.currentPrice ? formatPrice(product.currentPrice) : 'N/A'}
                </div>
                <div class="target-price">
                    Target: ${formatPrice(product.targetPrice)}
                </div>
            </div>
            <div class="status-badge ${statusClass}">
                ${product.status}
            </div>
        </div>
        <div>Added: ${formatDateTime(product.addedAt)}</div>
        <div>Last Check: ${product.lastChecked ? formatDateTime(product.lastChecked) : 'Never'}</div>
        <div class="chart-container" id="chart-${product.id}"></div>
        <div class="controls">
            <button onclick="toggleMonitoring(${product.id})">
                ${product.status === 'Active' ? 'Pause' : 'Resume'}
            </button>
            <button class="secondary" onclick="removeProduct(${product.id})">
                Remove
            </button>
        </div>
    `;

    return card;
}

// Update statistics
function updateStats(products) {
    const total = products.length;
    const active = products.filter(p => p.status === 'Active').length;
    const targetReached = products.filter(p => 
        p.currentPrice && p.currentPrice <= p.targetPrice
    ).length;

    document.getElementById('total-products').textContent = total;
    document.getElementById('active-monitoring').textContent = active;
    document.getElementById('target-reached').textContent = targetReached;

    const lastCheck = products.reduce((latest, p) => {
        if (!p.lastChecked) return latest;
        return !latest || new Date(p.lastChecked) > new Date(latest) 
            ? p.lastChecked 
            : latest;
    }, null);

    document.getElementById('last-check').textContent = 
        lastCheck ? formatDateTime(lastCheck) : 'Never';
}

// Load and display products
async function loadProducts() {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';

        if (!monitoredProducts || monitoredProducts.length === 0) {
            grid.innerHTML = '<div class="product-card">No products monitored yet</div>';
            updateStats([]);
            return;
        }

        monitoredProducts.forEach(product => {
            const card = createProductCard(product);
            grid.appendChild(card);
        });

        updateStats(monitoredProducts);
    } catch (error) {
        console.error('Failed to load products:', error);
    }
}

// Toggle product monitoring
async function toggleMonitoring(productId) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const product = monitoredProducts.find(p => p.id === productId);
        if (product) {
            product.status = product.status === 'Active' ? 'Waiting' : 'Active';
            await chrome.storage.local.set({ monitoredProducts });
            await loadProducts();
        }
    } catch (error) {
        console.error('Failed to toggle monitoring:', error);
    }
}

// Remove product
async function removeProduct(productId) {
    try {
        const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
        const newProducts = monitoredProducts.filter(p => p.id !== productId);
        await chrome.storage.local.set({ monitoredProducts: newProducts });
        await loadProducts();
    } catch (error) {
        console.error('Failed to remove product:', error);
    }
}

// Initialize
async function initialize() {
    await loadSettings();
    await loadProducts();
    
    // Start periodic updates
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    setInterval(loadProducts, CONFIG.refreshInterval);
}

// Make functions available globally
window.toggleMonitoring = toggleMonitoring;
window.removeProduct = removeProduct;

// Start dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
