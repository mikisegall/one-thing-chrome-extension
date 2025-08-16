// Daily Focus Extension - Background Script (Minimal Version)

console.log('🚀 Background script loaded at:', new Date().toLocaleTimeString());
console.log('🚀 Background script environment check:');
console.log('• chrome.runtime available:', !!chrome.runtime);
console.log('• chrome.storage available:', !!chrome.storage);

// Initialize when extension starts
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup detected');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed/updated');
});

// Utility function to get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Show notification with today's task
async function showTodayTaskNotification() {
  const todayKey = getTodayKey();
  const stored = await chrome.storage.local.get([todayKey]);
  const entry = stored[todayKey];
  if (!entry || !entry.task) {
    return;
  }

  const notificationOptions = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Reminder: Today\'s Focus',
    message: entry.task
  };

  try {
    chrome.notifications.create('daily-focus-reminder', notificationOptions);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

// Listen for alarms and display notification
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'daily-focus-reminder') {
    showTodayTaskNotification();
  }
});

// Allow popup to request scheduling an alarm one minute from now
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'schedule_daily_focus_reminder') {
    // Clear any existing reminder alarm to avoid duplicates
    chrome.alarms.clear('daily-focus-reminder', () => {
      chrome.alarms.create('daily-focus-reminder', { delayInMinutes: 1 });
      sendResponse({ ok: true });
    });
    return true; // Keep the message channel open for async sendResponse
  }
}); 