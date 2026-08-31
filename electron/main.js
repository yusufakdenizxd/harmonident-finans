const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

console.log('[Main] isDev:', isDev, 'app.isPackaged:', app.isPackaged)

function getDataPath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data')
  }
  return path.join(__dirname, 'data')
}

function getLegacyDataPath() {
  if (!app.isPackaged) {
    return null
  }
  return path.join(path.dirname(app.getPath('exe')), 'data')
}

function ensureDataDir() {
  const dataPath = getDataPath()
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }

  const legacyDataPath = getLegacyDataPath()
  if (legacyDataPath && legacyDataPath !== dataPath && fs.existsSync(legacyDataPath)) {
    for (const filename of ['transactions.json', 'history.json']) {
      const oldFilePath = path.join(legacyDataPath, filename)
      const newFilePath = path.join(dataPath, filename)
      if (fs.existsSync(oldFilePath) && !fs.existsSync(newFilePath)) {
        fs.copyFileSync(oldFilePath, newFilePath)
      }
    }
  }

  return dataPath
}

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('[Main] Preload path:', preloadPath)
  console.log('[Main] Preload exists:', fs.existsSync(preloadPath))

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('[Main] did-fail-load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] did-finish-load')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('[Main] Loading file from:', indexPath)
    console.log('[Main] File exists:', fs.existsSync(indexPath))
    mainWindow.loadFile(indexPath)
  }
}

ipcMain.handle('get-data-path', () => getDataPath())

ipcMain.handle('read-file', async (event, filename) => {
  console.log('[Main] read-file called:', filename)
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, filename)
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      console.log('[Main] read-file success:', filename)
      return JSON.parse(data)
    }
    console.log('[Main] read-file file not found:', filename)
    return null
  } catch (error) {
    console.error('[Main] read-file error:', error)
    return null
  }
})

ipcMain.handle('write-file', async (event, filename, data) => {
  console.log('[Main] write-file called:', filename)
  try {
    const dataPath = ensureDataDir()
    const filePath = path.join(dataPath, filename)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    console.log('[Main] write-file success:', filename)
    return true
  } catch (error) {
    console.error('[Main] write-file error:', error)
    return false
  }
})

ipcMain.handle('select-file', async () => {
  console.log('[Main] select-file called')
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ]
    })
    console.log('[Main] select-file dialog result:', result)
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      console.log('[Main] Reading file:', filePath)
      const buffer = fs.readFileSync(filePath)
      console.log('[Main] File read, size:', buffer.length)
      return {
        filename: path.basename(filePath),
        data: buffer
      }
    }
    console.log('[Main] select-file canceled or no file')
    return null
  } catch (error) {
    console.error('[Main] select-file error:', error)
    return null
  }
})

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
