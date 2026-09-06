const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('roastMySite', Object.freeze({
  analyzeUrl: (url, mode) => ipcRenderer.invoke('audit:url', { url, mode }),
  analyzeUpload: (imageDataUrl, url, mode) => ipcRenderer.invoke('audit:upload', { imageDataUrl, url, mode }),
  loadDemo: (mode) => ipcRenderer.invoke('audit:demo', { mode }),
}));
