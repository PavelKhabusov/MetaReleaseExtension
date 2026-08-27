<div align="center">

<img src="assets/icon.svg" width="96" alt="Meta Quest Release Manager">

# Meta Quest Release Manager

**VS Code extension for builds and release channels in the Meta Quest Store** — upload, promote
and inspect builds across ALPHA / BETA / RC / STORE without leaving the editor.

![Status](https://img.shields.io/badge/status-active-2ea043)
![Platform](https://img.shields.io/badge/platform-Linux%20%C2%B7%20macOS%20%C2%B7%20Windows-1f1f1f)
![License](https://img.shields.io/badge/license-MIT-7ba7d4)

![VS Code](https://img.shields.io/badge/VS%20Code-extension-007ACC?logo=visualstudiocode&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Meta Quest](https://img.shields.io/badge/Meta%20Quest-Store-0467DF?logo=meta&logoColor=white)

</div>

---

## Features

- **Sidebar Tree View** — view apps and release channels (ALPHA, BETA, RC, STORE) with current build info
- **Upload Build** — select APK and upload to a channel via `ovr-platform-util`, with real-time progress
- **Promote Build** — move builds between channels with confirmation
- **Browser Auth** — sign in to Meta Developer via browser OAuth flow
- **Secure Storage** — App Secrets stored via VSCode SecretStorage API (OS-level encryption)
- **Cross-platform** — works on Windows, macOS, Linux

## Prerequisites

- [ovr-platform-util](https://developer.oculus.com/documentation/publish/publish-reference-platform-command-line-utility/) installed and accessible in PATH (or set custom path in settings)
- Meta Developer Account with App credentials (App ID + App Secret)

## Getting Started

1. Install the extension
2. Open the **Meta Quest** sidebar (VR headset icon in Activity Bar)
3. Click **+** to add an app — enter App ID, display name, and App Secret
4. Your release channels will appear in the tree view
5. Right-click a channel to **Upload Build** or **Promote Build**

## Commands

| Command | Description |
|---|---|
| `Meta Quest: Add App` | Add a new Meta Quest app |
| `Meta Quest: Remove App` | Remove a configured app |
| `Meta Quest: Refresh` | Refresh apps and channels |
| `Meta Quest: Upload Build` | Upload an APK to a release channel |
| `Meta Quest: Promote Build` | Promote a build to another channel |
| `Meta Quest: Sign In to Meta Developer` | Authenticate via browser |
| `Meta Quest: Sign Out from Meta Developer` | Remove stored credentials |
| `Meta Quest: Set ovr-platform-util Path` | Set custom path to CLI binary |

## Settings

| Setting | Description | Default |
|---|---|---|
| `metaQuest.ovrPlatformUtilPath` | Path to ovr-platform-util binary | Auto-detect |
| `metaQuest.apps` | List of configured apps | `[]` |

## Development

```bash
npm install
npm run compile   # or npm run watch
```

Press `F5` in VSCode to launch the Extension Development Host.

## License

MIT
