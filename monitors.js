class ChromebookProductMonitor {
  constructor() {
    this.isMonitoring = false;
    this.memoryLimit = 50 * 1024 * 1024; // 50MB limit for Chromebook
  }

  async startMonitoring(productUrl) {
    // Check available memory before starting
    if (!this.checkMemoryUsage()) {
      throw new Error('Memory limit reached. Please remove some products.');
    }

    const productData = {
      url: productUrl,
      currentPrice: null,
      originalPrice: null,
      flashSaleTime: null,
      lastChecked: new Date().toISOString(),
      monitoringActive: true
    };

    try {
      await this.updateProductData(productData);
      return productData;
    } catch (error) {
      console.error('Monitoring error:', error);
      throw error;
    }
  }

  checkMemoryUsage() {
    if (performance && performance.memory) {
      return performance.memory.usedJSHeapSize < this.memoryLimit;
    }
    return true;
  }

  async updateProductData(productData) {
    // Use MutationObserver instead of polling for better performance
    const observer = new MutationObserver(async (mutations) => {
      const priceElement = document.querySelector('.shopee-price-value');
      const countdownElement = document.querySelector('.countdown-timer');
      
      if (priceElement) {
        productData.currentPrice = this.extractPrice(priceElement.textContent);
      }
      
      if (countdownElement) {
        productData.flashSaleTime = this.parseCountdown(countdownElement.textContent);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  parseCountdown(countdownText) {
    const timeRegex = /(\d{2}):(\d{2}):(\d{2})/;
    const match = countdownText.match(timeRegex);
    
    if (match) {
      const [_, hours, minutes, seconds] = match;
      const now = new Date();
      return new Date(now.getTime() + 
        (parseInt(hours) * 3600000) + 
        (parseInt(minutes) * 60000) + 
        (parseInt(seconds) * 1000)
      ).toISOString();
    }
    return null;
  }

  extractPrice(priceText) {
    return parseFloat(priceText.replace(/[^0-9.]/g, ''));
  }
}
