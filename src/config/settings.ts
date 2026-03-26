import * as vscode from 'vscode';
import { AppConfig } from '../models/app';

const CONFIG_SECTION = 'metaQuest';
const SECRET_PREFIX = 'metaQuest.appSecret.';
const USER_TOKEN_KEY = 'metaQuest.userAccessToken';

export class Settings {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getApps(): AppConfig[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<AppConfig[]>('apps', []);
  }

  async addApp(app: AppConfig): Promise<void> {
    const apps = this.getApps();
    const existing = apps.findIndex(a => a.appId === app.appId);
    if (existing >= 0) {
      apps[existing] = app;
    } else {
      apps.push(app);
    }
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update('apps', apps, vscode.ConfigurationTarget.Global);
  }

  async removeApp(appId: string): Promise<void> {
    const apps = this.getApps().filter(a => a.appId !== appId);
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update('apps', apps, vscode.ConfigurationTarget.Global);
    await this.deleteAppSecret(appId);
  }

  async getAppSecret(appId: string): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_PREFIX + appId);
  }

  async setAppSecret(appId: string, secret: string): Promise<void> {
    await this.context.secrets.store(SECRET_PREFIX + appId, secret);
  }

  async deleteAppSecret(appId: string): Promise<void> {
    await this.context.secrets.delete(SECRET_PREFIX + appId);
  }

  async getUserAccessToken(): Promise<string | undefined> {
    return this.context.secrets.get(USER_TOKEN_KEY);
  }

  async setUserAccessToken(token: string): Promise<void> {
    await this.context.secrets.store(USER_TOKEN_KEY, token);
  }

  async deleteUserAccessToken(): Promise<void> {
    await this.context.secrets.delete(USER_TOKEN_KEY);
  }

  getAccessToken(appId: string, appSecret: string): string {
    return `OC|${appId}|${appSecret}`;
  }

  getOvrPlatformUtilPath(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const customPath = config.get<string>('ovrPlatformUtilPath', '');
    if (customPath) {
      return customPath;
    }
    return this.getDefaultOvrPath();
  }

  private getDefaultOvrPath(): string {
    switch (process.platform) {
      case 'win32':
        return 'ovr-platform-util.exe';
      case 'darwin':
        return 'ovr-platform-util';
      case 'linux':
        return 'ovr-platform-util';
      default:
        return 'ovr-platform-util';
    }
  }
}
