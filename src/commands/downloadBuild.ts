import * as vscode from 'vscode';
import { Settings } from '../config/settings';
import { OvrPlatformUtil } from '../core/ovrPlatformUtil';
import { ChannelNode } from '../views/appsTreeProvider';

export async function downloadBuild(
  node: ChannelNode | undefined,
  settings: Settings,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  let appId: string;
  let buildId: string | undefined;

  if (node) {
    appId = node.appConfig.appId;
    buildId = node.channel.currentBuildId;
  } else {
    const apps = settings.getApps();
    if (apps.length === 0) {
      vscode.window.showWarningMessage('No apps configured. Add an app first.');
      return;
    }

    const selectedApp = await vscode.window.showQuickPick(
      apps.map(a => ({ label: a.appName || a.appId, appId: a.appId })),
      { placeHolder: 'Select app' }
    );
    if (!selectedApp) { return; }
    appId = selectedApp.appId;
  }

  if (!buildId) {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter Build ID to download',
      placeHolder: 'e.g. 123456789',
    });
    if (!input) { return; }
    buildId = input.trim();
  }

  const appSecret = await settings.getAppSecret(appId);
  if (!appSecret) {
    vscode.window.showErrorMessage(`No App Secret configured for ${appId}.`);
    return;
  }

  const destination = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Save to folder',
  });
  if (!destination || destination.length === 0) { return; }

  const destPath = destination[0].fsPath;
  const ovrPath = settings.getOvrPlatformUtilPath();
  const ovr = new OvrPlatformUtil(ovrPath);

  outputChannel.show(true);
  outputChannel.appendLine(`Downloading build #${buildId} for app ${appId} to ${destPath}...`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Downloading build #${buildId}`,
      cancellable: true,
    },
    async (progress, cancellation) => {
      const proc = ovr.downloadBuild(appId, appSecret, buildId!, destPath);

      cancellation.onCancellationRequested(() => {
        proc.cancel();
        outputChannel.appendLine('Download cancelled.');
      });

      proc.emitter.on('progress', (p) => {
        progress.report({ increment: p.percent, message: `${p.percent}%` });
        outputChannel.appendLine(p.message);
      });

      proc.emitter.on('log', (msg: string) => {
        outputChannel.appendLine(msg);
      });

      try {
        await proc.result;
        outputChannel.appendLine('Download completed successfully.');
        vscode.window.showInformationMessage(`Build #${buildId} downloaded to ${destPath}.`);
      } catch (err: any) {
        outputChannel.appendLine(`Download failed: ${err.message}`);
        vscode.window.showErrorMessage(`Download failed: ${err.message}`);
      }
    }
  );
}
