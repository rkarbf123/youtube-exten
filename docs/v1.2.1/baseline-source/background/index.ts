// Defaults are supplied by normalizeSettings on reads. Do not perform an
// asynchronous read-then-write on installation: it can overwrite a newer edit.
chrome.runtime.onInstalled.addListener(()=>{void chrome.action.setBadgeText({text:''});});
