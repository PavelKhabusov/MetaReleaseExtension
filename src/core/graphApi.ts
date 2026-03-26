import * as https from 'https';
import { AppInfo } from '../models/app';
import { ChannelInfo, ChannelName, ALL_CHANNELS } from '../models/channel';

const GRAPH_API_HOST = 'graph.oculus.com';

export class GraphApi {
  async getAppInfo(appId: string, accessToken: string): Promise<AppInfo> {
    const fields = 'id,display_name,platform,category';
    const data = await this.request(`/${appId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`);
    return JSON.parse(data) as AppInfo;
  }

  async getChannels(appId: string, accessToken: string): Promise<ChannelInfo[]> {
    try {
      const data = await this.request(
        `/${appId}/release_channels?fields=channel_name,latest_supported_binary&access_token=${encodeURIComponent(accessToken)}`
      );
      const response = JSON.parse(data);

      if (response.data && Array.isArray(response.data)) {
        return response.data.map((ch: any) => ({
          channelName: ch.channel_name as ChannelName,
          currentBuildId: ch.latest_supported_binary?.id,
          currentBuildVersion: ch.latest_supported_binary?.version,
        }));
      }
    } catch {
      // Fall back to default channels if API doesn't return them
    }

    return ALL_CHANNELS.map(name => ({
      channelName: name,
    }));
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const data = await this.request(`/me?access_token=${encodeURIComponent(accessToken)}`);
      const response = JSON.parse(data);
      return !!response.id;
    } catch {
      return false;
    }
  }

  private request(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: GRAPH_API_HOST,
        path,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Graph API error ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Graph API request failed: ${err.message}`));
      });

      req.end();
    });
  }
}
