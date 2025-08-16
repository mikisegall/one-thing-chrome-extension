// Daily Focus Extension - Popup Script

// Global state
let currentView = 'today';
let todayData = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
  setupEventListeners();
});

// Main initialization function
async function initializePopup() {
  await loadTodayData();
  await initializeSettingsUI();
  determineCurrentView();
  showView(currentView);
  updateStreakCounter();
  if (currentView === 'history') {
    loadHistoryData();
  }
}

// Determine which view to show based on task status and time
function determineCurrentView() {
  const now = new Date();
  const hour = now.getHours();
  
  // Check if today's task is set and if it's completed
  const hasTask = todayData && todayData.task;
  const isCompleted = todayData && todayData.completed;
  const isSkipped = todayData && todayData.skipped;
  
  // Today tab logic:
  // 1. If no task set (and not skipped), show morning input
  // 2. If task is set but not completed, and it's evening time, show evening reflection
  // 3. If task is set and it's still daytime, show today view with current task
  // 4. If completed or skipped today, show today's completed status
  
  if (!hasTask && !isSkipped) {
    currentView = 'morning';  // Show task input until task is set
  } else if (hasTask && !isCompleted && hour >= 20) {
    currentView = 'evening';  // Evening reflection time
  } else if (hasTask && !isCompleted) {
    currentView = 'today-task';    // Show current task during the day
  } else {
    currentView = 'today-completed';    // Show today's completed/skipped status
  }
}

// Show specific view and update navigation
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
  });
  
  // Show selected view
  switch(viewName) {
    case 'morning':
      document.getElementById('morning-view').classList.add('active');
      document.getElementById('nav-today').classList.add('active');
      break;
    case 'evening':
      document.getElementById('evening-view').classList.add('active');
      document.getElementById('nav-today').classList.add('active');
      loadEveningData();
      break;
    case 'today-task':
      document.getElementById('today-task-view').classList.add('active');
      document.getElementById('nav-today').classList.add('active');
      loadTodayTaskData();
      break;
    case 'today-completed':
      document.getElementById('today-completed-view').classList.add('active');
      document.getElementById('nav-today').classList.add('active');
      loadTodayCompletedData();
      break;
    case 'today':
      // Auto-determine which today view to show
      determineCurrentView();
      showView(currentView);
      return;
    case 'history':
      document.getElementById('history-view').classList.add('active');
      document.getElementById('nav-history').classList.add('active');
      loadHistoryData();
      break;
    case 'settings':
      document.getElementById('settings-view').classList.add('active');
      document.getElementById('nav-settings').classList.add('active');
      break;
  }
  
  currentView = viewName;
}

// Load today's data from storage
async function loadTodayData() {
  const today = getTodayKey();
  const result = await chrome.storage.local.get([today]);
  todayData = result[today] || null;
}

// Load evening view with today's task
function loadEveningData() {
  if (todayData && todayData.task) {
    document.getElementById('evening-task').textContent = `Today's Focus: ${todayData.task}`;
  }
}

// Load today's task view
function loadTodayTaskData() {
  if (todayData && todayData.task) {
    document.getElementById('current-task').textContent = todayData.task;
  }
}

// Load today's completed view
function loadTodayCompletedData() {
  const completedTaskElement = document.getElementById('today-completed-task');
  const completedStatusElement = document.getElementById('today-completed-status');
  
  if (todayData) {
    if (todayData.skipped) {
      completedTaskElement.textContent = 'Day skipped';
      completedStatusElement.textContent = 'You skipped today';
      completedStatusElement.className = 'completed-status skipped';
    } else if (todayData.completed && todayData.task) {
      completedTaskElement.textContent = todayData.task;
      completedStatusElement.textContent = 'Completed ✓';
      completedStatusElement.className = 'completed-status completed';
    }
  }
}

// Edit current task
function editCurrentTask() {
  showView('morning');
  // Pre-fill the input with current task
  if (todayData && todayData.task) {
    document.getElementById('morning-task').value = todayData.task;
    updateCharCount('morning-task', 'task-count');
  }
}

// Complete task early (go to evening reflection)
function completeTaskEarly() {
  showView('evening');
}

// Setup all event listeners
function setupEventListeners() {
  // Navigation
  document.getElementById('nav-today').addEventListener('click', () => showView('today'));
  document.getElementById('nav-history').addEventListener('click', () => showView('history'));
  document.getElementById('nav-settings').addEventListener('click', () => showView('settings'));
  
  // Morning view
  document.getElementById('morning-task').addEventListener('input', () => {
    updateCharCount('morning-task', 'task-count');
  });
  document.getElementById('set-focus').addEventListener('click', setDailyFocus);
  document.getElementById('skip-today').addEventListener('click', skipToday);
  
  // Evening view
  document.getElementById('complete-day').addEventListener('click', completeDay);
  
  // Today task view
  document.getElementById('edit-task').addEventListener('click', editCurrentTask);
  document.getElementById('complete-early').addEventListener('click', completeTaskEarly);

  // Settings view
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('reset-settings').addEventListener('click', resetSettingsToDefaults);
}

// Set daily focus task
async function setDailyFocus() {
  const taskInput = document.getElementById('morning-task');
  const task = taskInput.value.trim();
  
  if (!task) {
    alert('Please enter a task for today');
    return;
  }
  
  const today = getTodayKey();
  const dayData = {
    task: task,
    date: today,
    completed: false
  };
  
  await chrome.storage.local.set({ [today]: dayData });
  todayData = dayData;
  
  // Schedule reminder notifications using current settings
  try {
    await chrome.runtime.sendMessage({ type: 'schedule_reminders_after_task_set' });
  } catch (e) {
    console.warn('Could not schedule reminders:', e);
  }
  
  // Clear input and show today's task view
  taskInput.value = '';
  updateCharCount('morning-task', 'task-count');
  showView('today-task');
}

// Skip today's task
async function skipToday() {
  const today = getTodayKey();
  const dayData = {
    task: null,
    date: today,
    completed: true,
    skipped: true
  };
  
  await chrome.storage.local.set({ [today]: dayData });
  todayData = dayData;

  // Stop reminders for today
  try {
    await chrome.runtime.sendMessage({ type: 'clear_reminders_for_today' });
  } catch (e) {}

  showView('today-completed');
}

// Complete day with simple completion (no rating or reflection)
async function completeDay() {
  const today = getTodayKey();
  const dayData = {
    ...todayData,
    completed: true,
    completedAt: new Date().toISOString()
  };
  
  await chrome.storage.local.set({ [today]: dayData });
  todayData = dayData;

  // Stop reminders for today
  try {
    await chrome.runtime.sendMessage({ type: 'clear_reminders_for_today' });
  } catch (e) {}
  
  // Update streak and show today's completed view
  await updateStreakCounter();
  showView('today-completed');
}

// Update character count for inputs
function updateCharCount(inputId, countId) {
  const input = document.getElementById(inputId);
  const count = document.getElementById(countId);
  count.textContent = input.value.length;
}

// Calculate and update streak counter
async function updateStreakCounter() {
  const result = await chrome.storage.local.get(null);
  const entries = Object.keys(result)
    .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
    .map(key => ({ date: key, ...result[key] }))
    .filter(entry => entry.completed && !entry.skipped)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let streak = 0;
  const today = getTodayKey();
  let checkDate = new Date();
  
  // If today is completed, start from today, otherwise start from yesterday
  if (!entries.find(e => e.date === today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  while (true) {
    const dateKey = checkDate.toISOString().split('T')[0];
    const entry = entries.find(e => e.date === dateKey);
    
    if (entry && entry.completed && !entry.skipped) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  document.getElementById('streak-count').textContent = streak;
}

// Load and display history data (only past days)
async function loadHistoryData() {
  const result = await chrome.storage.local.get(null);
  const today = getTodayKey();
  
  const entries = Object.keys(result)
    .filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/))
    .filter(key => key < today) // Only show days before today
    .map(key => ({ date: key, ...result[key] }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20); // Show last 20 entries
  
  const historyList = document.getElementById('history-list');
  
  if (entries.length === 0) {
    historyList.innerHTML = '<div class="empty-state"><p>No history yet. Complete some daily tasks!</p></div>';
    return;
  }
  
  historyList.innerHTML = entries.map(entry => {
    const date = new Date(entry.date).toLocaleDateString();
    
    if (entry.skipped) {
      return `
        <div class="history-item">
          <div class="history-date">${date}</div>
          <div class="history-task skipped">Day skipped</div>
          <div class="history-status">Skipped</div>
        </div>
      `;
    }
    
    const isCompleted = entry.completed;
    const taskClass = isCompleted ? 'completed' : 'incomplete';
    const taskText = isCompleted ? `${entry.task || 'No task set'}` : entry.task || 'No task set';
    const statusText = isCompleted ? 'Completed ✓' : 'Not completed';
    const statusClass = isCompleted ? 'completed' : 'incomplete';
    
    return `
      <div class="history-item">
        <div class="history-date">${date}</div>
        <div class="history-task ${taskClass}">${taskText}</div>
        <div class="history-status ${statusClass}">${statusText}</div>
      </div>
    `;
  }).join('');
}

// Utility function to get today's date key
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Settings helpers
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

async function loadSettings() {
  const { settings } = await chrome.storage.local.get(['settings']);
  return { ...getDefaultSettings(), ...(settings || {}) };
}

async function initializeSettingsUI() {
  const s = await loadSettings();
  // Time input expects HH:MM in 24h
  const morningStr = `${String(s.morningHour).padStart(2,'0')}:${String(s.morningMinute).padStart(2,'0')}`;
  const eveningStr = `${String(s.eveningHour).padStart(2,'0')}:${String(s.eveningMinute).padStart(2,'0')}`;
  
  document.getElementById('enable-morning').checked = !!s.enableMorning;
  document.getElementById('enable-evening').checked = !!s.enableEvening;
  document.getElementById('enable-reminders').checked = !!s.enableReminders;
  document.getElementById('morning-time').value = morningStr;
  document.getElementById('evening-time').value = eveningStr;
  document.getElementById('reminder-minutes').value = String(s.reminderMinutes);
}

async function saveSettings() {
  const enableMorning = document.getElementById('enable-morning').checked;
  const enableEvening = document.getElementById('enable-evening').checked;
  const enableReminders = document.getElementById('enable-reminders').checked;

  const morningTime = (document.getElementById('morning-time').value || '10:00').split(':');
  const eveningTime = (document.getElementById('evening-time').value || '18:00').split(':');

  const reminderMinutes = Number(document.getElementById('reminder-minutes').value || '60');

  const newSettings = {
    enableMorning,
    enableEvening,
    enableReminders,
    morningHour: Number(morningTime[0]) || 10,
    morningMinute: Number(morningTime[1]) || 0,
    eveningHour: Number(eveningTime[0]) || 18,
    eveningMinute: Number(eveningTime[1]) || 0,
    reminderMinutes: Math.max(1, reminderMinutes)
  };

  await chrome.storage.local.set({ settings: newSettings });

  // Ask background to reschedule morning/evening alarms
  try {
    await chrome.runtime.sendMessage({ type: 'reschedule_morning_evening' });
  } catch (e) {}

  alert('Settings saved');
}

async function resetSettingsToDefaults() {
  const defaults = getDefaultSettings();
  await chrome.storage.local.set({ settings: defaults });
  await initializeSettingsUI();
  try {
    await chrome.runtime.sendMessage({ type: 'reschedule_morning_evening' });
  } catch (e) {}
}



 