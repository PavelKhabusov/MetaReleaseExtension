import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceConfig } from '../config/workspaceConfig';
import { Settings } from '../config/settings';

const TASK_TYPE = 'meta-quest';

interface MetaQuestTaskDefinition extends vscode.TaskDefinition {
  action: 'upload' | 'promote' | 'download';
  appId: string;
  channel?: string;
  apkPath?: string;
  buildId?: string;
}

export class MetaQuestTaskProvider implements vscode.TaskProvider {
  constructor(
    private readonly settings: Settings,
    private readonly workspaceConfig: WorkspaceConfig,
  ) {}

  provideTasks(): vscode.Task[] {
    const tasks: vscode.Task[] = [];
    const wsApps = this.workspaceConfig.getApps();

    for (const app of wsApps) {
      if (app.apkPath && app.defaultChannel) {
        const definition: MetaQuestTaskDefinition = {
          type: TASK_TYPE,
          action: 'upload',
          appId: app.appId,
          channel: app.defaultChannel,
          apkPath: app.apkPath,
        };

        const task = new vscode.Task(
          definition,
          vscode.TaskScope.Workspace,
          `Upload ${app.appName || app.appId} → ${app.defaultChannel}`,
          'Meta Quest',
          new vscode.ShellExecution(this.buildUploadCommand(app.appId, app.defaultChannel, app.apkPath)),
        );
        task.group = vscode.TaskGroup.Build;
        tasks.push(task);
      }
    }

    return tasks;
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as MetaQuestTaskDefinition;

    if (definition.action === 'upload' && definition.apkPath && definition.channel) {
      return new vscode.Task(
        definition,
        vscode.TaskScope.Workspace,
        task.name,
        'Meta Quest',
        new vscode.ShellExecution(this.buildUploadCommand(definition.appId, definition.channel, definition.apkPath)),
      );
    }

    return undefined;
  }

  private buildUploadCommand(appId: string, channel: string, apkPath: string): string {
    const ovrPath = this.settings.getOvrPlatformUtilPath();
    const resolvedApk = this.resolveApkPath(apkPath);

    // App secret will be passed via environment or the user runs the command manually
    return `"${ovrPath}" upload-quest-build --app-id ${appId} --app-secret $META_QUEST_APP_SECRET --apk "${resolvedApk}" --channel ${channel}`;
  }

  private resolveApkPath(apkPath: string): string {
    if (path.isAbsolute(apkPath)) {
      return apkPath;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, apkPath);
    }

    return apkPath;
  }
}
