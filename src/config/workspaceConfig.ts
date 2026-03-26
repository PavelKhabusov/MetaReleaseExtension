import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AppConfig } from '../models/app';
import { ChannelName } from '../models/channel';

const CONFIG_FILE = '.meta-quest.json';

export interface WorkspaceAppConfig {
  appId: string;
  appName?: string;
  defaultChannel?: ChannelName;
  apkPath?: string;
  obbPath?: string;
  postBuildUpload?: boolean;
}

export interface MetaQuestWorkspaceConfig {
  apps: WorkspaceAppConfig[];
}

export class WorkspaceConfig {
  private configPath: string | null = null;
  private watcher: vscode.FileSystemWatcher | null = null;

  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor() {
    this.configPath = this.findConfigFile();
    this.setupWatcher();
  }

  hasConfig(): boolean {
    return this.configPath !== null && fs.existsSync(this.configPath);
  }

  load(): MetaQuestWorkspaceConfig | null {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as MetaQuestWorkspaceConfig;
    } catch {
      return null;
    }
  }

  getApps(): WorkspaceAppConfig[] {
    const config = this.load();
    return config?.apps || [];
  }

  toAppConfigs(): AppConfig[] {
    return this.getApps().map(a => ({
      appId: a.appId,
      appName: a.appName,
    }));
  }

  async createDefault(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    const filePath = path.join(workspaceFolders[0].uri.fsPath, CONFIG_FILE);
    const defaultConfig: MetaQuestWorkspaceConfig = {
      apps: [
        {
          appId: 'YOUR_APP_ID',
          appName: 'My VR App',
          defaultChannel: 'ALPHA',
          apkPath: './build/output.apk',
          postBuildUpload: false,
        },
      ],
    };

    fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    this.configPath = filePath;

    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
  }

  private findConfigFile(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) { return null; }

    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return null;
  }

  private setupWatcher(): void {
    this.watcher = vscode.workspace.createFileSystemWatcher(`**/${CONFIG_FILE}`);
    this.watcher.onDidChange(() => {
      this.configPath = this.findConfigFile();
      this._onDidChange.fire();
    });
    this.watcher.onDidCreate(() => {
      this.configPath = this.findConfigFile();
      this._onDidChange.fire();
    });
    this.watcher.onDidDelete(() => {
      this.configPath = this.findConfigFile();
      this._onDidChange.fire();
    });
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChange.dispose();
  }
}
