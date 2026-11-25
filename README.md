# npm Run Buttons

Open **npm Scripts** from the VS Code Activity Bar and click a script. Its
live output uses your theme's terminal colors. Click a file path in the output
to open it in the editor at the reported line and column. Use the **Stop script**
and **Clear output** icons to control the run log.

The sidebar reads the root `package.json` of each open workspace folder and
refreshes when it changes. It runs one script at a time using npm from the
project directory, including npm's pre- and post-script hooks.

Requires a trusted workspace, Node.js, and npm on PATH. On Windows the
extension expects the standard npm installation with `npm-cli.js` next to the
npm launcher under `node_modules/npm/bin`. The sidebar is a read-only output
stream, so scripts that prompt for interactive input are unsupported.

## Install

Download the VSIX from [GitHub Releases](https://github.com/0mandrock1/npm-run-buttons/releases),
then run **Extensions: Install from VSIX...** in VS Code and choose the file.

## Build

```sh
npm run check
npx @vscode/vsce package
```
