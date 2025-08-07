chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    monitoredProducts: [],
    settings: {
      useSpaylater: true,
      installmentMonths: 6,
      lastUpdated: new Date().toISOString()
    }
  });
});

// Set up price checking alarm
chrome.alarms.create('priceCheck', {
  periodInMinutes: 1
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    const { monitoredProducts } = await chrome.storage.local.get('monitoredProducts');
    checkPrices(monitoredProducts);
  }
});

async function checkPrices(products) {
  for (const product of products) {
    try {
      const response = await fetch(product.url);
      if (!response.ok) continue;
      
      // Check if price meets target
      chrome.tabs.create({
        url: product.url,
        active: false
      }, (tab) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      });
    } catch (error) {
      console.error('Error checking price:', error);
    }
  }
}
