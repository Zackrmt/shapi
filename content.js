import { CONFIG, PriceManager, StorageManager, DebugUtils } from './utils.js';

class ProductMonitor {
    constructor() {
        this.config = {
            userLogin: 'Zackrmt',
            startTime: '2025-08-07 13:10:45',
            timeZone: 'UTC',
            checkInterval: 5000,
            maxRetries: 3,
            retryDelay: 1000
        };
        this.monitors = new Map();
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadActiveMonitors();
            this.startGlobalMonitoring();
            DebugUtils.log('Product Monitor initialized');
        } catch (error) {
            DebugUtils.error('Monitor initialization error:', error);
        }
    }

    async loadActiveMonitors() {
        const products = await StorageManager.getMonitoredProducts();
        products.forEach(product => {
            if (product.status === 'Active') {
                this.startMonitoring(product);
            }
        });
    }

    startGlobalMonitoring() {
        setInterval(async () => {
            try {
                const products = await StorageManager.getMonitoredProducts();
                products.forEach(product => {
                    if (product.status === 'Active' && !this.monitors.has(product.id)) {
                        this.startMonitoring(product);
                    } else if (product.status !== 'Active' && this.monitors.has(product.id)) {
                        this.stopMonitoring(product.id);
                    }
                });
            } catch (error) {
                DebugUtils.error('Global monitoring error:', error);
            }
        }, this.config.checkInterval);
    }

    async startMonitoring(product) {
        if (this.monitors.has(product.id)) {
            return;
        }

        const monitor = {
            id: product.id,
            interval: setInterval(async () => {
                await this.checkPrice(product);
            }, this.config.checkInterval),
            retries: 0,
            lastCheck: new Date()
        };

        this.monitors.set(product.id, monitor);
        DebugUtils.log(`Started monitoring product ${product.id}`);
    }

    stopMonitoring(productId) {
        const monitor = this.monitors.get(productId);
        if (monitor) {
            clearInterval(monitor.interval);
            this.monitors.delete(productId);
            DebugUtils.log(`Stopped monitoring product ${productId}`);
        }
    }

    async checkPrice(product) {
        const monitor = this.monitors.get(product.id);
        if (!monitor) return;

        try {
            const response = await fetch(product.url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const priceMatch = html.match(/class="product-price"[^>]*>([^<]+)/);
            
            if (priceMatch) {
                const currentPrice = PriceManager.parse(priceMatch[1]);
                if (!isNaN(currentPrice)) {
                    await this.updateProductPrice(product, currentPrice);
                    monitor.retries = 0;
                    monitor.lastCheck = new Date();
                }
            }
        } catch (error) {
            monitor.retries++;
            DebugUtils.error(`Price check error for product ${product.id}:`, error);
            
            if (monitor.retries >= this.config.maxRetries) {
                this.handleMonitorError(product);
            } else {
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
            }
        }
    }

    async updateProductPrice(product, newPrice) {
        try {
            const products = await StorageManager.getMonitoredProducts();
            const updatedProduct = products.find(p => p.id === product.id);
            
            if (updatedProduct) {
                updatedProduct.currentPrice = newPrice;
                updatedProduct.lastChecked = new Date().toISOString();
                updatedProduct.priceHistory = updatedProduct.priceHistory || [];
                updatedProduct.priceHistory.push({
                    price: newPrice,
                    timestamp: new Date().toISOString()
                });

                // Keep only last 100 price points
                if (updatedProduct.priceHistory.length > 100) {
                    updatedProduct.priceHistory.shift();
                }

                // Check if target price reached
                if (newPrice <= updatedProduct.targetPrice) {
                    chrome.runtime.sendMessage({
                        type: 'TARGET_PRICE_REACHED',
                        product: updatedProduct
                    });
                }

                await StorageManager.saveMonitoredProducts(products);
                DebugUtils.log(`Updated price for product ${product.id}: ${newPrice}`);
            }
        } catch (error) {
            DebugUtils.error('Price update error:', error);
        }
    }

    handleMonitorError(product) {
        this.stopMonitoring(product.id);
        chrome.runtime.sendMessage({
            type: 'MONITOR_ERROR',
            product: product,
            error: `Failed to monitor product after ${this.config.maxRetries} attempts`
        });
    }

    async addProduct(url, targetPrice) {
        try {
            const products = await StorageManager.getMonitoredProducts();
            const newProduct = {
                id: Date.now(),
                url,
                targetPrice,
                status: 'Active',
                addedAt: new Date().toISOString(),
                addedBy: this.config.userLogin,
                currentPrice: null,
                lastChecked: null,
                priceHistory: []
            };

            products.push(newProduct);
            await StorageManager.saveMonitoredProducts(products);
            this.startMonitoring(newProduct);
            
            return newProduct;
        } catch (error) {
            DebugUtils.error('Add product error:', error);
            throw error;
        }
    }

    async removeProduct(productId) {
        try {
            this.stopMonitoring(productId);
            const products = await StorageManager.getMonitoredProducts();
            const filteredProducts = products.filter(p => p.id !== productId);
            await StorageManager.saveMonitoredProducts(filteredProducts);
            DebugUtils.log(`Removed product ${productId}`);
        } catch (error) {
            DebugUtils.error('Remove product error:', error);
            throw error;
        }
    }
}

// Initialize monitor when content script loads
const productMonitor = new ProductMonitor();
export default productMonitor;
