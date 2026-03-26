import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { UploadConfig, UploadProgress, ChannelName } from '../models/channel';

export class OvrPlatformUtil {
  constructor(private readonly binaryPath: string) {}

  uploadBuild(config: UploadConfig): OvrProcess {
    const args = [
      'upload-quest-build',
      '--app-id', config.appId,
      '--app-secret', config.appSecret,
      '--apk', config.apkPath,
      '--channel', config.channel,
    ];

    if (config.obbPath) {
      args.push('--obb', config.obbPath);
    }

    return this.runWithProgress(args);
  }

  setReleaseChannelBuild(appId: string, appSecret: string, channel: ChannelName, buildId: string): OvrProcess {
    const args = [
      'set-release-channel-build',
      '--app-id', appId,
      '--app-secret', appSecret,
      '--channel', channel,
      '--build-id', buildId,
    ];

    return this.runWithProgress(args);
  }

  downloadBuild(appId: string, appSecret: string, buildId: string, destPath: string): OvrProcess {
    const args = [
      'download-quest-build',
      '--app-id', appId,
      '--app-secret', appSecret,
      '--build-id', buildId,
      '--output', destPath,
    ];

    return this.runWithProgress(args);
  }

  listBuilds(appId: string, appSecret: string): Promise<string> {
    return this.run([
      'list-builds',
      '--app-id', appId,
      '--app-secret', appSecret,
    ]);
  }

  private runWithProgress(args: string[]): OvrProcess {
    const emitter = new EventEmitter();
    const proc = spawn(this.binaryPath, args);
    let output = '';

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      const progress = this.parseProgress(text);
      emitter.emit('progress', progress);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      output += text;
      emitter.emit('log', text);
    });

    const resultPromise = new Promise<string>((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`ovr-platform-util exited with code ${code}\n${output}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run ovr-platform-util: ${err.message}`));
      });
    });

    return {
      process: proc,
      emitter,
      result: resultPromise,
      cancel: () => proc.kill('SIGTERM'),
    };
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ovr-platform-util exited with code ${code}\n${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to run ovr-platform-util: ${err.message}`));
      });
    });
  }

  private parseProgress(text: string): UploadProgress {
    // ovr-platform-util outputs progress like "Uploading... 45%"
    const percentMatch = text.match(/(\d+(?:\.\d+)?)%/);
    const buildIdMatch = text.match(/Build ID:\s*(\d+)/i);

    return {
      percent: percentMatch ? parseFloat(percentMatch[1]) : 0,
      message: text.trim(),
      buildId: buildIdMatch ? buildIdMatch[1] : undefined,
    };
  }
}

export interface OvrProcess {
  process: ChildProcess;
  emitter: EventEmitter;
  result: Promise<string>;
  cancel: () => void;
}
