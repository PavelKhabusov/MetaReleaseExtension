import * as vscode from 'vscode';
import { Settings } from './config/settings';
import { WorkspaceConfig } from './config/workspaceConfig';
import { GraphApi } from './core/graphApi';
import { MetaAuth } from './core/auth';
import { OvrPlatformUtil } from './core/ovrPlatformUtil';
import { UploadQueue } from './core/uploadQueue';
import { MetaQuestTaskProvider } from './core/taskProvider';
import { AppsTreeProvider, AppNode } from './views/appsTreeProvider';
import { AppPanel } from './views/appPanel';
import { uploadBuild } from './commands/uploadBuild';
import { promoteBuild } from './commands/promoteBuild';
import { downloadBuild } from './commands/downloadBuild';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Meta Quest');

  const settings = new Settings(context);
  const graphApi = new GraphApi();
  const auth = new MetaAuth();
  const workspaceConfig = new WorkspaceConfig();
  const treeProvider = new AppsTreeProvider(settings, graphApi);

  const ovrPath = settings.getOvrPlatformUtilPath();
  const ovr = new OvrPlatformUtil(ovrPath);
  const uploadQueue = new UploadQueue(ovr, outputChannel);

  // Task Provider for build integration
  const taskProvider = vscode.tasks.registerTaskProvider(
    'meta-quest',
    new MetaQuestTaskProvider(settings, workspaceConfig)
  );

  // Refresh tree when workspace config changes
  workspaceConfig.onDidChange(() => {
    treeProvider.refresh();
  });

  uploadQueue.onComplete(({ item, buildId }) => {
    const fileName = item.apkPath.split(/[\\/]/).pop() || item.apkPath;
    vscode.window.showInformationMessage(
      `Upload complete: ${fileName} → ${item.channel}${buildId ? ` (Build #${buildId})` : ''}`
    );
    treeProvider.refresh();
  });

  uploadQueue.onError(({ item, error }) => {
    const fileName = item.apkPath.split(/[\\/]/).pop() || item.apkPath;
    vscode.window.showErrorMessage(`Upload failed: ${fileName} — ${error.message}`);
  });

  const treeView = vscode.window.createTreeView('metaQuestApps', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // Set initial context for welcome view
  const apps = settings.getApps();
  vscode.commands.executeCommand('setContext', 'metaQuest.noApps', apps.length === 0);

  context.subscriptions.push(
    treeView,
    outputChannel,
    uploadQueue,
    workspaceConfig,
    taskProvider,

    vscode.commands.registerCommand('metaQuest.refresh', () => {
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('metaQuest.addApp', async () => {
      const appId = await vscode.window.showInputBox({
        prompt: 'Enter Meta Quest App ID',
        placeHolder: 'e.g. 1234567890',
        validateInput: (value) => {
          if (!value || !/^\d+$/.test(value.trim())) {
            return 'App ID must be a numeric value';
          }
          return undefined;
        },
      });
      if (!appId) { return; }

      const appName = await vscode.window.showInputBox({
        prompt: 'Enter a display name for this app (optional)',
        placeHolder: 'e.g. My VR App',
      });

      const appSecret = await vscode.window.showInputBox({
        prompt: 'Enter App Secret',
        placeHolder: 'Your app secret from Meta Developer Dashboard',
        password: true,
      });
      if (!appSecret) {
        vscode.window.showWarningMessage('App Secret is required.');
        return;
      }

      await settings.addApp({ appId: appId.trim(), appName: appName?.trim() });
      await settings.setAppSecret(appId.trim(), appSecret.trim());
      treeProvider.refresh();
      vscode.window.showInformationMessage(`App ${appName || appId} added.`);
    }),

    vscode.commands.registerCommand('metaQuest.removeApp', async (node) => {
      const appId = node?.appConfig?.appId;
      if (!appId) { return; }

      const confirm = await vscode.window.showWarningMessage(
        `Remove app ${node.label}?`,
        { modal: true },
        'Remove'
      );
      if (confirm !== 'Remove') { return; }

      await settings.removeApp(appId);
      treeProvider.refresh();
    }),

    vscode.commands.registerCommand('metaQuest.uploadBuild', (node) => {
      return uploadBuild(node, settings, uploadQueue);
    }),

    vscode.commands.registerCommand('metaQuest.promoteBuild', (node) => {
      return promoteBuild(node, settings, outputChannel);
    }),

    vscode.commands.registerCommand('metaQuest.downloadBuild', (node) => {
      return downloadBuild(node, settings, outputChannel);
    }),

    vscode.commands.registerCommand('metaQuest.openAppPanel', (node: AppNode) => {
      if (!node?.appConfig) { return; }
      AppPanel.createOrShow(node.appConfig, settings, graphApi, context.extensionUri);
    }),

    vscode.commands.registerCommand('metaQuest.showUploadQueue', () => {
      outputChannel.show(true);
    }),

    vscode.commands.registerCommand('metaQuest.initWorkspaceConfig', () => {
      workspaceConfig.createDefault();
    }),

    vscode.commands.registerCommand('metaQuest.setOvrPath', async () => {
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select ovr-platform-util',
      });
      if (!files || files.length === 0) { return; }

      await vscode.workspace.getConfiguration('metaQuest').update(
        'ovrPlatformUtilPath',
        files[0].fsPath,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage('ovr-platform-util path updated.');
    }),

    vscode.commands.registerCommand('metaQuest.login', async () => {
      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Signing in to Meta Developer...',
            cancellable: false,
          },
          async () => {
            const token = await auth.login();
            await settings.setUserAccessToken(token);
            vscode.window.showInformationMessage('Signed in to Meta Developer successfully.');
            treeProvider.refresh();
          }
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Login failed: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('metaQuest.logout', async () => {
      await settings.deleteUserAccessToken();
      vscode.window.showInformationMessage('Signed out from Meta Developer.');
      treeProvider.refresh();
    }),
  );
}

export function deactivate() {
  // Cleanup handled by disposables
}
