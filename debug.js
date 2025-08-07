class DebugConsole {
  constructor() {
    this.logContainer = document.getElementById('log-container');
    this.setupEventListeners();
    this.loadInitialState();
  }

  setupEventListeners() {
    document.getElementById('enable-debug').addEventListener('click', () => this.toggleDebug());
    document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());
    document.getElementById('test-notification').addEventListener('click', () => this.testNotification());
  }

  async loadInitialState() {
    const { settings } = await chrome.storage.local.get('settings');
    this.updateBotStatus(settings);
    this.loadMonitoredProducts();
  }

  async toggleDebug() {
    const { settings } = await chrome.storage.local.get('settings');
    settings.debugMode = !settings.debugMode;
    await chrome.storage.local.set({ settings });
    this.log(`Debug mode ${settings.debugMode ? 'enabled' : 'disabled'}`);
  }

  clearLogs() {
    this.logContainer.innerHTML = '';
  }

  async testNotification() {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon128.png',
      title: 'Shopee Bot Test',
      message: 'Notification system is working!'
    });
  }

  log(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = `[${new Date().toISOString()}] ${message}`;
    this.logContainer.appendChild(logEntry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  async loadMonitoredProducts() {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';

    monitoredProducts?.forEach(product => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div>URL: ${product.url}</div>
        <div>Target Price: ${product.targetPrice}</div>
        <div>Last Checked: ${product.lastChecked}</div>
        ${product.flashSaleTime ? `<div>Flash Sale: ${product.flashSaleTime}</div>` : ''}
      `;
      productList.appendChild(div);
    });
  }

  updateBotStatus(settings) {
    const statusDiv = document.getElementById('bot-status');
    statusDiv.innerHTML = `
      <div>SPaylater: ${settings.useSpaylater ? 'Enabled' : 'Disabled'}</div>
      <div>Installment: ${settings.installmentMonths} months</div>
      <div>Debug Mode: ${settings.debugMode ? 'Enabled' : 'Disabled'}</div>
    `;
  }
}

new DebugConsole();
