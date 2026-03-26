import * as vscode from 'vscode';
import { AppConfig, AppInfo } from '../models/app';
import { ChannelInfo } from '../models/channel';
import { Settings } from '../config/settings';
import { GraphApi } from '../core/graphApi';

export class AppPanel {
  private static panels = new Map<string, AppPanel>();

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    appConfig: AppConfig,
    settings: Settings,
    graphApi: GraphApi,
    extensionUri: vscode.Uri,
  ): AppPanel {
    const existing = AppPanel.panels.get(appConfig.appId);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      existing.refresh(appConfig, settings, graphApi);
      return existing;
    }

    const panel = new AppPanel(appConfig, settings, graphApi, extensionUri);
    AppPanel.panels.set(appConfig.appId, panel);
    return panel;
  }

  private constructor(
    private appConfig: AppConfig,
    private settings: Settings,
    private graphApi: GraphApi,
    extensionUri: vscode.Uri,
  ) {
    const title = appConfig.appName || appConfig.appId;

    this.panel = vscode.window.createWebviewPanel(
      'metaQuestApp',
      `Meta Quest: ${title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    this.panel.iconPath = new vscode.ThemeIcon('device-mobile');

    this.panel.onDidDispose(() => {
      AppPanel.panels.delete(this.appConfig.appId);
      this.dispose();
    }, null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables,
    );

    this.refresh(appConfig, settings, graphApi);
  }

  async refresh(appConfig: AppConfig, settings: Settings, graphApi: GraphApi): Promise<void> {
    this.appConfig = appConfig;
    this.settings = settings;
    this.graphApi = graphApi;

    let appInfo: AppInfo | null = null;
    let channels: ChannelInfo[] = [];

    const secret = await settings.getAppSecret(appConfig.appId);
    if (secret) {
      const token = settings.getAccessToken(appConfig.appId, secret);
      try {
        [appInfo, channels] = await Promise.all([
          graphApi.getAppInfo(appConfig.appId, token),
          graphApi.getChannels(appConfig.appId, token),
        ]);
      } catch {
        // Will show with limited data
      }
    }

    this.panel.webview.html = this.getHtml(appInfo, channels);
  }

  private handleMessage(message: any): void {
    switch (message.command) {
      case 'refresh':
        this.refresh(this.appConfig, this.settings, this.graphApi);
        break;
      case 'upload':
        vscode.commands.executeCommand('metaQuest.uploadBuild');
        break;
      case 'promote':
        vscode.commands.executeCommand('metaQuest.promoteBuild');
        break;
    }
  }

  private getHtml(appInfo: AppInfo | null, channels: ChannelInfo[]): string {
    const name = appInfo?.display_name || this.appConfig.appName || this.appConfig.appId;
    const nonce = getNonce();

    const channelRows = channels.map(ch => {
      const version = ch.currentBuildVersion ? `v${ch.currentBuildVersion}` : '';
      const buildId = ch.currentBuildId ? `#${ch.currentBuildId}` : 'No build';
      const icon = getChannelIcon(ch.channelName);
      return `<tr>
        <td class="channel-name">${icon} ${ch.channelName}</td>
        <td>${version}</td>
        <td>${buildId}</td>
        <td class="actions">
          <button onclick="postMessage('promote', '${ch.channelName}')" title="Promote">&#8594;</button>
        </td>
      </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --header-bg: var(--vscode-sideBarSectionHeader-background);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
      --button-hover: var(--vscode-button-hoverBackground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      padding: 20px;
      margin: 0;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .header h1 {
      margin: 0;
      font-size: 1.4em;
      font-weight: 600;
    }

    .header .app-id {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }

    button {
      background: var(--button-bg);
      color: var(--button-fg);
      border: none;
      padding: 6px 14px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 0.85em;
    }

    button:hover {
      background: var(--button-hover);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }

    th {
      text-align: left;
      padding: 8px 12px;
      background: var(--header-bg);
      font-weight: 600;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }

    .channel-name {
      font-weight: 600;
    }

    .actions button {
      padding: 2px 8px;
      font-size: 1.1em;
      background: transparent;
      color: var(--fg);
      border: 1px solid var(--border);
    }

    .actions button:hover {
      background: var(--button-bg);
      color: var(--button-fg);
    }

    .info-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 6px 16px;
      margin-bottom: 24px;
    }

    .info-label {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    h2 {
      font-size: 1.1em;
      font-weight: 600;
      margin: 24px 0 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(name)}</h1>
      <div class="app-id">App ID: ${escapeHtml(this.appConfig.appId)}</div>
    </div>
  </div>

  ${appInfo ? `
  <div class="info-grid">
    <span class="info-label">Platform</span><span>${escapeHtml(appInfo.platform || 'N/A')}</span>
    <span class="info-label">Category</span><span>${escapeHtml(appInfo.category || 'N/A')}</span>
  </div>
  ` : ''}

  <div class="toolbar">
    <button onclick="postMessage('upload')">&#8593; Upload Build</button>
    <button onclick="postMessage('refresh')">&#8635; Refresh</button>
  </div>

  <h2>Release Channels</h2>
  <table>
    <thead>
      <tr>
        <th>Channel</th>
        <th>Version</th>
        <th>Build</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${channelRows || '<tr><td colspan="4">No channels available</td></tr>'}
    </tbody>
  </table>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function postMessage(command, data) {
      vscode.postMessage({ command, data });
    }
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getChannelIcon(name: string): string {
  switch (name) {
    case 'ALPHA': return '&#x1F9EA;';
    case 'BETA': return '&#x1F41B;';
    case 'RC': return '&#x2705;';
    case 'STORE': return '&#x1F4E6;';
    default: return '&#x25CB;';
  }
}
