import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import {
  writeFileSync,
  lstatSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "fs";
import { exec, spawn } from "child_process";
import { isBinaryFile as IsBinaryFile } from "isbinaryfile";
import { AnsiUp as _AnsiUp } from "ansi_up";
import EscapeHtml from "escape-html";

const MaxFileSize = 100 * 1024 * 1024;

function CreateWindow() {
  const Win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, "Preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
      devTools: true,
    },
    autoHideMenuBar: true,
  });

  Win.loadFile("UI/Main/index.html");

  Win.webContents.setZoomFactor(1);
  Win.webContents.on("did-finish-load", () => {
    Win.webContents.setZoomFactor(1);
  });
}

app.whenReady().then(() => {
  CreateWindow();
  ipcMain.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) CreateWindow();
  });
});

ipcMain.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("save-file", async (Event, Data) => {
  const { filePath } = await dialog.showSaveDialog({
    filters: [{ name: "All Files", extensions: ["*"] }],
  });

  if (filePath) {
    writeFileSync(filePath, Data);
  }
});

const CheckBinary = async (FilePath) => {
  const Stats = lstatSync(FilePath);
  if (Stats.size > MaxFileSize) {
    return true;
  }

  const Data = readFileSync(FilePath);
  const Result = await IsBinaryFile(Data, Stats.size);
  return Result;
};

const GetDirectoryContents = async (DirPath) => {
  const Result = { Path: DirPath, Items: [] };
  const Items = readdirSync(DirPath);

  for (const Item of Items) {
    const FullPath = join(DirPath, Item);

    try {
      const Stat = lstatSync(FullPath);

      if (Stat.isDirectory()) {
        Result.Items.push({
          Name: Item,
          Type: "directory",
          Path: FullPath,
        });
      } else if (Stat.isFile()) {
        const IsBinary = await CheckBinary(FullPath);
        Result.Items.push({
          Name: Item,
          Type: IsBinary ? "invalid-file" : "file",
          Path: FullPath,
        });
      }
    } catch (Error) {
      console.error(`Error reading: ${FullPath}`, Error);
    }
  }

  return Result;
};

ipcMain.handle("open-folder", async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (filePaths?.length) {
    const FolderPath = filePaths[0];
    if (existsSync(FolderPath)) {
      return await GetDirectoryContents(FolderPath);
    }
  }

  return null;
});

ipcMain.handle("load-children", async (Event, FolderPath) => {
  if (existsSync(FolderPath) && lstatSync(FolderPath).isDirectory()) {
    return await GetDirectoryContents(FolderPath);
  }
  return { Path: FolderPath, Items: [] };
});

ipcMain.handle("load-file", async (Event, FilePath) => {
  if (existsSync(FilePath)) {
    try {
      const Stats = lstatSync(FilePath);
      if (Stats.size > MaxFileSize) return null;

      const IsBinary = await CheckBinary(FilePath);
      if (IsBinary) return null;

      return readFileSync(FilePath, "utf-8");
    } catch (Error) {
      return null;
    }
  }

  return "File does not exist!";
});

let PowerShell = null;
let AccumulatedOutput = "";
let ShouldRestartPowerShell = false;
let LatestEvent = null;

function InitPowerShell(Event) {
  if (!PowerShell) {
    LatestEvent = Event;
    AccumulatedOutput = "";

    PowerShell = spawn("powershell.exe", ["-NoExit", "-Command", "-"]);

    PowerShell.stdout.on("data", (Data) => {
      AccumulatedOutput += Data.toString();
      if (LatestEvent) {
        LatestEvent.sender.send("output", ConvertAnsiToHtml(AccumulatedOutput));
      }
    });

    PowerShell.stderr.on("data", (Data) => {
      AccumulatedOutput += `Error: ${Data.toString()}`;
      if (LatestEvent) {
        LatestEvent.sender.send("output", ConvertAnsiToHtml(AccumulatedOutput));
      }
    });

    PowerShell.on("close", () => {
      PowerShell = null;
      AccumulatedOutput = "";

      if (ShouldRestartPowerShell && LatestEvent) {
        ShouldRestartPowerShell = false;
        InitPowerShell(LatestEvent);
        PowerShell.stdin.write('cd "C:/"\n');
        PowerShell.stdin.write('echo "Console Restarted!"\n');
      }
    });

    PowerShell.stdin.write('cd "C:/"\n');
    PowerShell.stdin.write('echo "Initialized Console!"\n');
  }
}

function ConvertAnsiToHtml(Input) {
  const EscapedInput = EscapeHtml(Input);
  const AnsiUp = new _AnsiUp();
  const Output = AnsiUp.ansi_to_html(Input);
  return Output;
}

ipcMain.on("initalize", (Event) => {
  if (!PowerShell) {
    InitPowerShell(Event);
  } else {
    Event.sender.send("output", ConvertAnsiToHtml(AccumulatedOutput));
  }
});

ipcMain.on("run-command", (Event, Command) => {
  const TrimmedCommand = Command.trim().toLowerCase();
  LatestEvent = Event;

  if (!PowerShell) {
    Event.sender.send("output", "[ PowerShell is not running ]\n");
    return;
  }

  AccumulatedOutput += `> ${Command}\n`;
  Event.sender.send("output", ConvertAnsiToHtml(AccumulatedOutput));

  switch (TrimmedCommand) {
    case "clear":
    case "cls":
      AccumulatedOutput = "";
      Event.sender.send("output", ConvertAnsiToHtml(AccumulatedOutput));
      PowerShell.stdin.write("Clear-Host\n");
      break;

    case "exit":
      AccumulatedOutput = "";
      ShouldRestartPowerShell = true;
      const KillCommand = `taskkill /PID ${PowerShell.pid} /T /F`;
      spawn("cmd.exe", ["/c", KillCommand]);
      break;

    default:
      PowerShell.stdin.write(Command + "\n");
      break;
  }
});
