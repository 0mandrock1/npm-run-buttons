# npm Run Buttons

Run npm scripts and read their live output in the **npm Scripts** sidebar in
VS Code without opening the integrated terminal.

## Install

1. Download the `.vsix` file from the [latest GitHub release](https://github.com/0mandrock1/npm-run-buttons/releases/latest).
2. Open the VS Code Command Palette and run **Extensions: Install from VSIX...**.
3. Select the downloaded file. If an open window still shows the previous
   version, run **Developer: Reload Window**.

## Run a script

1. Open a trusted workspace with a `package.json` at the root of at least one
   workspace folder.
2. Select **npm Scripts** in the Activity Bar and click the play button next
   to a script.
3. Read stdout, stderr, and the exit status in the sidebar. ANSI colors use
   your VS Code terminal palette. Click a file location such as
   `src/index.ts:12:4` to jump to line 12, column 4 in the editor.

Use the **Stop script** icon to end a running script and the **Clear output**
icon to empty the log.

## Requirements and behavior

- VS Code 1.85 or later, a trusted workspace, and Node.js with npm on PATH.
  On Windows, use an npm installation that provides `npm.cmd` and
  `node_modules/npm/bin/npm-cli.js` in the same installation directory.
- The script list refreshes when a workspace folder's root `package.json`
  changes. To list scripts from a nested package, add it as a workspace folder.
- The sidebar runs one script at a time with `npm run` from the package
  directory, including npm's pre- and post-script hooks.
- Output is read-only. Scripts that require keyboard input need an interactive
  terminal.

## Build a VSIX from source

```sh
npm run check
npx @vscode/vsce package
```
