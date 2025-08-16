// Daily Focus Extension - Background Script

console.log('🚀 Background script loaded at:', new Date().toLocaleTimeString());
console.log('🚀 Background script environment check:');
console.log('• chrome.runtime available:', !!chrome.runtime);
console.log('• chrome.storage available:', !!chrome.storage);

const ALARM_MORNING = 'daily-focus-morning';
const ALARM_REMINDER = 'daily-focus-reminder';
const ALARM_EVENING = 'daily-focus-evening';

const NOTIF_MORNING = 'notif-daily-focus-morning';
const NOTIF_REMINDER = 'notif-daily-focus-reminder';
const NOTIF_EVENING = 'notif-daily-focus-evening';

// Utility function to get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getDefaultSettings() {
  return {
    morningHour: 10,
    morningMinute: 0,
    eveningHour: 18,
    eveningMinute: 0,
    reminderMinutes: 60,
    enableMorning: true,
    enableEvening: true,
    enableReminders: true
  };
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get(['settings']);
  return { ...getDefaultSettings(), ...(settings || {}) };
}

function nextOccurrenceTimestamp(targetHour, targetMinute) {
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function showMorningNotification() {
  const options = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Good morning!',
    message: 'Set your task for today in Daily Focus.'
  };
  try {
    chrome.notifications.create(NOTIF_MORNING, options);
  } catch (error) {
    console.error('Failed to create morning notification:', error);
  }
}

async function showReminderNotification() {
  const todayKey = getTodayKey();
  const stored = await chrome.storage.local.get([todayKey]);
  const entry = stored[todayKey];

  // If completed/skipped, stop reminders
  if (entry && (entry.completed || entry.skipped)) {
    chrome.alarms.clear(ALARM_REMINDER);
    return;
  }

  const hasTask = entry && entry.task;
  const options = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: hasTask ? "Reminder: Today's Focus" : 'Set your task for today',
    message: hasTask ? entry.task : 'You have not set your focus yet. Open Daily Focus to set it now.'
  };

  try {
    chrome.notifications.create(NOTIF_REMINDER, options);
  } catch (error) {
    console.error('Failed to create reminder notification:', error);
  }
}

async function showEveningNotification() {
  const todayKey = getTodayKey();
  const stored = await chrome.storage.local.get([todayKey]);
  const entry = stored[todayKey];

  const options = {
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Evening check-in',
    message: 'Did you complete your task today? Open the app to update your status.'
  };

  // Stop reminders at evening time if task completed or skipped; if not, let reminders continue until user completes or the day rolls over
  if (entry && (entry.completed || entry.skipped)) {
    chrome.alarms.clear(ALARM_REMINDER);
  }

  try {
    chrome.notifications.create(NOTIF_EVENING, options);
  } catch (error) {
    console.error('Failed to create evening notification:', error);
  }
}

async function scheduleMorningEveningAlarms() {
  const settings = await getSettings();

  // Clear existing daily alarms to avoid duplicates
  await Promise.all([
    chrome.alarms.clear(ALARM_MORNING),
    chrome.alarms.clear(ALARM_EVENING)
  ]);

  if (settings.enableMorning) {
    chrome.alarms.create(ALARM_MORNING, {
      when: nextOccurrenceTimestamp(settings.morningHour, settings.morningMinute)
    });
  }

  if (settings.enableEvening) {
    chrome.alarms.create(ALARM_EVENING, {
      when: nextOccurrenceTimestamp(settings.eveningHour, settings.eveningMinute)
    });
  }
}

async function scheduleReminderAlarmsFromNow() {
  const settings = await getSettings();
  if (!settings.enableReminders) {
    await chrome.alarms.clear(ALARM_REMINDER);
    return;
  }

  // Start reminders the specified number of minutes from now and repeat with the same interval
  const period = Math.max(1, Number(settings.reminderMinutes || 60));
  await chrome.alarms.clear(ALARM_REMINDER);
  chrome.alarms.create(ALARM_REMINDER, {
    delayInMinutes: period,
    periodInMinutes: period
  });
}

// When the user clicks any notification, open the extension UI
chrome.notifications.onClicked.addListener((notificationId) => {
  const isKnown = [NOTIF_MORNING, NOTIF_REMINDER, NOTIF_EVENING].includes(notificationId);
  if (isKnown) {
    try {
      if (chrome.action && typeof chrome.action.openPopup === 'function') {
        chrome.action.openPopup();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
      }
    } catch (e) {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    } finally {
      chrome.notifications.clear(notificationId);
    }
  }
});

// Listen for alarms and display notification; also reschedule daily alarms for next day
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm || !alarm.name) return;

  switch (alarm.name) {
    case ALARM_MORNING: {
      await showMorningNotification();
      // At the start of a new day, stop previous reminder loop until a new task is set
      try { await chrome.alarms.clear(ALARM_REMINDER); } catch (e) {}
      // Reschedule for next day
      const settings = await getSettings();
      if (settings.enableMorning) {
        chrome.alarms.create(ALARM_MORNING, {
          when: nextOccurrenceTimestamp(settings.morningHour, settings.morningMinute)
        });
      }
      break;
    }
    case ALARM_REMINDER: {
      await showReminderNotification();
      break;
    }
    case ALARM_EVENING: {
      await showEveningNotification();
      // Reschedule for next day
      const settings = await getSettings();
      if (settings.enableEvening) {
        chrome.alarms.create(ALARM_EVENING, {
          when: nextOccurrenceTimestamp(settings.eveningHour, settings.eveningMinute)
        });
      }
      break;
    }
  }
});

// Messages from popup to manage alarms
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'schedule_reminders_after_task_set') {
    scheduleReminderAlarmsFromNow().then(() => sendResponse({ ok: true })).catch(err => {
      console.error('Failed to schedule reminders:', err);
      sendResponse({ ok: false, error: String(err) });
    });
    return true; // async
  }

  if (message.type === 'clear_reminders_for_today') {
    chrome.alarms.clear(ALARM_REMINDER, () => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'reschedule_morning_evening') {
    scheduleMorningEveningAlarms().then(() => sendResponse({ ok: true })).catch(err => {
      console.error('Failed to reschedule daily alarms:', err);
      sendResponse({ ok: false, error: String(err) });
    });
    return true; // async
  }

  // Backward compatibility
  if (message.type === 'schedule_daily_focus_reminder') {
    scheduleReminderAlarmsFromNow().then(() => sendResponse({ ok: true })).catch(err => {
      console.error('Failed to schedule reminders:', err);
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  }
});

// Initialize when extension starts
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Extension startup detected');
  scheduleMorningEveningAlarms();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔧 Extension installed/updated');
  scheduleMorningEveningAlarms();
}); 