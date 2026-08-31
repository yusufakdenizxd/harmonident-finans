const { contextBridge, ipcRenderer } = require('electron')

console.log('[Preload] Loading preload script')

contextBridge.exposeInMainWorld('electronAPI', {
  getDataPath: () => {
    console.log('[Preload] getDataPath called')
    return ipcRenderer.invoke('get-data-path')
  },
  readFile: (filename) => {
    console.log('[Preload] readFile called:', filename)
    return ipcRenderer.invoke('read-file', filename)
  },
  writeFile: (filename, data) => {
    console.log('[Preload] writeFile called:', filename)
    return ipcRenderer.invoke('write-file', filename, data)
  },
  selectFile: () => {
    console.log('[Preload] selectFile called')
    return ipcRenderer.invoke('select-file')
  }
})

console.log('[Preload] electronAPI exposed')