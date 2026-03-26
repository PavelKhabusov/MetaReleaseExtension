import * as vscode from 'vscode';
import { Settings } from '../config/settings';
import { UploadQueue } from '../core/uploadQueue';
import { ChannelNode } from '../views/appsTreeProvider';
import { ChannelName, UploadConfig } from '../models/channel';

export async function uploadBuild(
  node: ChannelNode | undefined,
  settings: Settings,
  uploadQueue: UploadQueue,
): Promise<void> {
  let appId: string;
  let channel: ChannelName;

  if (node) {
    appId = node.appConfig.appId;
    channel = node.channel.channelName;
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

    const selectedChannel = await vscode.window.showQuickPick(
      ['ALPHA', 'BETA', 'RC', 'STORE'],
      { placeHolder: 'Select channel' }
    );
    if (!selectedChannel) { return; }
    channel = selectedChannel as ChannelName;
  }

  const appSecret = await settings.getAppSecret(appId);
  if (!appSecret) {
    vscode.window.showErrorMessage(`No App Secret configured for ${appId}. Please set it first.`);
    return;
  }

  const apkFiles = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'APK Files': ['apk'] },
    openLabel: 'Select APK',
  });

  if (!apkFiles || apkFiles.length === 0) { return; }
  const apkPath = apkFiles[0].fsPath;

  const uploadConfig: UploadConfig = {
    appId,
    appSecret,
    apkPath,
    channel,
  };

  try {
    await uploadQueue.enqueue(uploadConfig);
  } catch {
    // Errors are handled by uploadQueue.onError in extension.ts
  }
}
