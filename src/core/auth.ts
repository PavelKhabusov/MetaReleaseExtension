import * as vscode from 'vscode';
import * as http from 'http';

const META_AUTH_URL = 'https://www.meta.com/weblogin/';
const REDIRECT_PORT = 53242;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

export class MetaAuth {
  private server: http.Server | null = null;

  async login(): Promise<string> {
    const token = await this.startOAuthFlow();
    return token;
  }

  private async startOAuthFlow(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`);

        if (url.pathname === '/callback') {
          const token = url.searchParams.get('access_token') || url.searchParams.get('token');

          res.writeHead(200, { 'Content-Type': 'text/html' });
          if (token) {
            res.end(this.getSuccessHtml());
            this.cleanup();
            resolve(token);
          } else {
            // Token may come as a hash fragment — serve a page that extracts it
            res.end(this.getTokenExtractorHtml());
          }
        } else if (url.pathname === '/token') {
          const token = url.searchParams.get('token');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getSuccessHtml());
          this.cleanup();
          if (token) {
            resolve(token);
          } else {
            reject(new Error('No token received'));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.server.listen(REDIRECT_PORT, () => {
        const authUrl = `${META_AUTH_URL}?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        vscode.env.openExternal(vscode.Uri.parse(authUrl));
      });

      this.server.on('error', (err) => {
        this.cleanup();
        reject(new Error(`Failed to start auth server: ${err.message}`));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        this.cleanup();
        reject(new Error('Authentication timed out'));
      }, 5 * 60 * 1000);
    });
  }

  private cleanup(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private getTokenExtractorHtml(): string {
    return `<!DOCTYPE html>
<html>
<body>
<p>Completing authentication...</p>
<script>
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  if (token) {
    window.location.href = '/token?token=' + encodeURIComponent(token);
  } else {
    document.body.innerHTML = '<p>Authentication failed: no token found.</p>';
  }
</script>
</body>
</html>`;
  }

  private getSuccessHtml(): string {
    return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
<div style="text-align: center;">
  <h2>Authentication Successful</h2>
  <p>You can close this tab and return to VSCode.</p>
</div>
</body>
</html>`;
  }

  dispose(): void {
    this.cleanup();
  }
}
