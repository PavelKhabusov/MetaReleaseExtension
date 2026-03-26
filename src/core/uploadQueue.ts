import * as vscode from 'vscode';
import { OvrPlatformUtil, OvrProcess } from './ovrPlatformUtil';
import { UploadConfig, UploadProgress } from '../models/channel';

interface QueueItem {
  config: UploadConfig;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentProcess: OvrProcess | null = null;
  private statusBarItem: vscode.StatusBarItem;

  private _onProgress = new vscode.EventEmitter<{ item: UploadConfig; progress: UploadProgress }>();
  readonly onProgress = this._onProgress.event;

  private _onComplete = new vscode.EventEmitter<{ item: UploadConfig; buildId?: string }>();
  readonly onComplete = this._onComplete.event;

  private _onError = new vscode.EventEmitter<{ item: UploadConfig; error: Error }>();
  readonly onError = this._onError.event;

  constructor(
    private readonly ovr: OvrPlatformUtil,
    private readonly outputChannel: vscode.OutputChannel,
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.statusBarItem.command = 'metaQuest.showUploadQueue';
  }

  enqueue(config: UploadConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, resolve, reject });
      this.updateStatusBar();
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  get pendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  cancelCurrent(): void {
    if (this.currentProcess) {
      this.currentProcess.cancel();
    }
  }

  cancelAll(): void {
    this.cancelCurrent();
    const remaining = this.queue.splice(0);
    for (const item of remaining) {
      item.reject(new Error('Upload cancelled'));
    }
    this.updateStatusBar();
  }

  private async processNext(): Promise<void> {
    const item = this.queue.shift();
    if (!item) {
      this.isProcessing = false;
      this.updateStatusBar();
      return;
    }

    this.isProcessing = true;
    this.updateStatusBar();

    const { config, resolve, reject } = item;
    const fileName = config.apkPath.split(/[\\/]/).pop() || config.apkPath;

    this.outputChannel.appendLine(`\n[Queue] Uploading ${fileName} → ${config.channel} (app ${config.appId})`);

    this.currentProcess = this.ovr.uploadBuild(config);

    this.currentProcess.emitter.on('progress', (p: UploadProgress) => {
      this._onProgress.fire({ item: config, progress: p });
      this.statusBarItem.text = `$(cloud-upload) ${config.channel}: ${p.percent}%`;
      this.statusBarItem.tooltip = `Uploading ${fileName} to ${config.channel}\n${this.queue.length} in queue`;
    });

    this.currentProcess.emitter.on('log', (msg: string) => {
      this.outputChannel.appendLine(msg);
    });

    try {
      const result = await this.currentProcess.result;
      const buildIdMatch = result.match(/Build ID:\s*(\d+)/i);
      const buildId = buildIdMatch?.[1];

      this.outputChannel.appendLine(`[Queue] Upload complete: ${fileName} → ${config.channel}`);
      this._onComplete.fire({ item: config, buildId });
      resolve(result);
    } catch (err: any) {
      this.outputChannel.appendLine(`[Queue] Upload failed: ${fileName} — ${err.message}`);
      this._onError.fire({ item: config, error: err });
      reject(err);
    } finally {
      this.currentProcess = null;
      this.processNext();
    }
  }

  private updateStatusBar(): void {
    const total = this.pendingCount;
    if (total === 0) {
      this.statusBarItem.hide();
    } else if (this.isProcessing) {
      this.statusBarItem.text = `$(cloud-upload) Uploading... (${total} remaining)`;
      this.statusBarItem.show();
    } else {
      this.statusBarItem.text = `$(cloud-upload) ${total} uploads queued`;
      this.statusBarItem.show();
    }
  }

  dispose(): void {
    this.cancelAll();
    this.statusBarItem.dispose();
    this._onProgress.dispose();
    this._onComplete.dispose();
    this._onError.dispose();
  }
}
