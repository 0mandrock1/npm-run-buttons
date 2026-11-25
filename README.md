# npm Run Buttons

Open **npm Run Buttons** from the VS Code Activity Bar and click a script. Its
live standard output, errors, and exit status appear in the sidebar. Use
**Stop** for long-running scripts and **Clear** to empty the output.

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
