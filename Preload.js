const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFolder: () => ipcRenderer.invoke('open-folder'),
    saveFile: (data) => ipcRenderer.send('save-file', data),
    loadFile: (data) => ipcRenderer.invoke('load-file', data),
    runCommand: (command) => ipcRenderer.send('run-command', command),
    initalize: () => ipcRenderer.send('initalize'),
    onOutput: (callback) => ipcRenderer.on('output', callback),
    loadChildren: (Path) => ipcRenderer.invoke('load-children', Path)
});
