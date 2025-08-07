class ChromebookShopeeBot {
  constructor() {
    this.settings = null;
    this.monitor = new ChromebookProductMonitor();
    this.retryAttempts = 3;
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Use event delegation for better performance
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-buy-now')) {
        e.preventDefault();
        await this.handleBuyNowClick();
      }
    }, { passive: false });
  }

  async handleBuyNowClick() {
    try {
      await this.autoBuyProcess();
    } catch (error) {
      console.error('Auto-buy error:', error);
      this.showNotification('Auto-buy failed', error.message);
    }
  }

  async autoBuyProcess() {
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        await this.selectSpaylater();
        await this.completeCheckout();
        this.showNotification('Success', 'Order placed successfully!');
        break;
      } catch (error) {
        if (attempt === this.retryAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async selectSpaylater() {
    const spaylaterOption = await this.waitForElement('[data-payment-method="spaylater"]');
    spaylaterOption.click();
    
    await this.waitForElement('.installment-options');
    
    const installmentOption = await this.waitForElement(
      `[data-installment="${this.settings.installmentMonths}"]`
    );
    installmentOption.click();
  }

  showNotification(title, message) {
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      message
    });
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  }
}
