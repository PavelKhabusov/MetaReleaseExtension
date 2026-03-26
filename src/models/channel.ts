export type ChannelName = 'ALPHA' | 'BETA' | 'RC' | 'STORE';

export const ALL_CHANNELS: ChannelName[] = ['ALPHA', 'BETA', 'RC', 'STORE'];

export interface ChannelInfo {
  channelName: ChannelName;
  currentBuildId?: string;
  currentBuildVersion?: string;
}

export interface UploadProgress {
  percent: number;
  message: string;
  buildId?: string;
}

export interface UploadConfig {
  appId: string;
  appSecret: string;
  apkPath: string;
  channel: ChannelName;
  obbPath?: string;
}
