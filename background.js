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