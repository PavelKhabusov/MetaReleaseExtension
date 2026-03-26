import * as vscode from 'vscode';
import { Settings } from '../config/settings';
import { OvrPlatformUtil } from '../core/ovrPlatformUtil';
import { ChannelNode } from '../views/appsTreeProvider';
import { ChannelName, ALL_CHANNELS } from '../models/channel';

export async function promoteBuild(
  node: ChannelNode | undefined,
  settings: Settings,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  let appId: string;
  let sourceBuildId: string | undefined;
  let sourceChannelName: string;

  if (node) {
    appId = node.appConfig.appId;
    sourceBuildId = node.channel.currentBuildId;
    sourceChannelName = node.channel.channelName;
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
    sourceChannelName = 'selected app';
  }

  if (!sourceBuildId) {
    const buildIdInput = await vscode.window.showInputBox({
      prompt: 'Enter the Build ID to promote',
      placeHolder: 'e.g. 123456789',
    });
    if (!buildIdInput) { return; }
    sourceBuildId = buildIdInput;
  }

  const targetChannel = await vscode.window.showQuickPick(
    ALL_CHANNELS.filter(ch => node ? ch !== node.channel.channelName : true),
    { placeHolder: `Promote build #${sourceBuildId} to which channel?` }
  );
  if (!targetChannel) { return; }

  const confirm = await vscode.window.showWarningMessage(
    `Promote build #${sourceBuildId} from ${sourceChannelName} to ${targetChannel}?`,
    { modal: true },
    'Promote'
  );
  if (confirm !== 'Promote') { return; }

  const appSecret = await settings.getAppSecret(appId);
  if (!appSecret) {
    vscode.window.showErrorMessage(`No App Secret configured for ${appId}.`);
    return;
  }

  const ovrPath = settings.getOvrPlatformUtilPath();
  const ovr = new OvrPlatformUtil(ovrPath);

  outputChannel.show(true);
  outputChannel.appendLine(`Promoting build #${sourceBuildId} to ${targetChannel} for app ${appId}...`);

  try {
    const proc = ovr.setReleaseChannelBuild(appId, appSecret, targetChannel as ChannelName, sourceBuildId);

    proc.emitter.on('log', (msg: string) => {
      outputChannel.appendLine(msg);
    });

    await proc.result;
    outputChannel.appendLine('Promote completed successfully.');
    vscode.window.showInformationMessage(`Build #${sourceBuildId} promoted to ${targetChannel}.`);
  } catch (err: any) {
    outputChannel.appendLine(`Promote failed: ${err.message}`);
    vscode.window.showErrorMessage(`Promote failed: ${err.message}`);
  }
}
