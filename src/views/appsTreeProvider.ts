import * as vscode from 'vscode';
import { Settings } from '../config/settings';
import { GraphApi } from '../core/graphApi';
import { AppConfig, AppInfo } from '../models/app';
import { ChannelInfo, ChannelName } from '../models/channel';

export class AppsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private appInfoCache = new Map<string, AppInfo>();
  private channelsCache = new Map<string, ChannelInfo[]>();

  constructor(
    private readonly settings: Settings,
    private readonly graphApi: GraphApi,
  ) {}

  refresh(): void {
    this.appInfoCache.clear();
    this.channelsCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      return this.getAppNodes();
    }

    if (element instanceof AppNode) {
      return this.getChannelNodes(element.appConfig);
    }

    return [];
  }

  private async getAppNodes(): Promise<AppNode[]> {
    const apps = this.settings.getApps();

    if (apps.length === 0) {
      vscode.commands.executeCommand('setContext', 'metaQuest.noApps', true);
      return [];
    }

    vscode.commands.executeCommand('setContext', 'metaQuest.noApps', false);

    const nodes: AppNode[] = [];

    for (const app of apps) {
      let info = this.appInfoCache.get(app.appId);

      if (!info) {
        const secret = await this.settings.getAppSecret(app.appId);
        if (secret) {
          try {
            const token = this.settings.getAccessToken(app.appId, secret);
            info = await this.graphApi.getAppInfo(app.appId, token);
            this.appInfoCache.set(app.appId, info);
          } catch {
            // Use config name if API fails
          }
        }
      }

      const displayName = info?.display_name || app.appName || app.appId;
      nodes.push(new AppNode(app, displayName));
    }

    return nodes;
  }

  private async getChannelNodes(app: AppConfig): Promise<ChannelNode[]> {
    let channels = this.channelsCache.get(app.appId);

    if (!channels) {
      const secret = await this.settings.getAppSecret(app.appId);
      if (secret) {
        try {
          const token = this.settings.getAccessToken(app.appId, secret);
          channels = await this.graphApi.getChannels(app.appId, token);
          this.channelsCache.set(app.appId, channels);
        } catch {
          channels = (['ALPHA', 'BETA', 'RC', 'STORE'] as ChannelName[]).map(name => ({
            channelName: name,
          }));
        }
      } else {
        channels = (['ALPHA', 'BETA', 'RC', 'STORE'] as ChannelName[]).map(name => ({
          channelName: name,
        }));
      }
    }

    return channels.map(ch => new ChannelNode(app, ch));
  }
}

export class AppNode extends vscode.TreeItem {
  constructor(
    public readonly appConfig: AppConfig,
    displayName: string,
  ) {
    super(displayName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'app';
    this.description = appConfig.appId;
    this.iconPath = new vscode.ThemeIcon('device-mobile');
    this.tooltip = `${displayName} (${appConfig.appId})`;
    this.command = {
      command: 'metaQuest.openAppPanel',
      title: 'Open App Details',
      arguments: [this],
    };
  }
}

export class ChannelNode extends vscode.TreeItem {
  constructor(
    public readonly appConfig: AppConfig,
    public readonly channel: ChannelInfo,
  ) {
    super(channel.channelName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'channel';

    if (channel.currentBuildVersion) {
      this.description = `v${channel.currentBuildVersion}`;
    } else if (channel.currentBuildId) {
      this.description = `#${channel.currentBuildId}`;
    } else {
      this.description = 'No build';
    }

    this.iconPath = new vscode.ThemeIcon(this.getChannelIcon(channel.channelName));
    this.tooltip = `${channel.channelName}: ${this.description}`;
  }

  private getChannelIcon(name: ChannelName): string {
    switch (name) {
      case 'ALPHA': return 'beaker';
      case 'BETA': return 'bug';
      case 'RC': return 'check';
      case 'STORE': return 'package';
      default: return 'circle-outline';
    }
  }
}

export type TreeNode = AppNode | ChannelNode;
