const vscode = require('vscode');
const path = require('node:path');
const { npmCommand, run, stop, fileLocation } = require('./runner');

function activate(context) {
  let view;
  let projects = new Map();
  let current;
  let output = '';
  let status = '';
  let outputFolder;
  let outputTimer;
  let refreshVersion = 0;

  function post(message) {
    void view?.webview.postMessage(message);
  }

  function state() {
    post({ type: 'state', projects: [...projects.values()].map(({ id, label, scripts, error }) =>
      ({ id, label, scripts: [...scripts], error })), status, busy: !!current, canStop: !!current?.child });
  }

  function append(chunk) {
    output += chunk;
    if (output.length > 100_000) {
      const nextLine = output.indexOf('\n', output.length - 100_000);
      output = output.slice(nextLine < 0 ? -100_000 : nextLine + 1);
    }
    outputTimer ??= setTimeout(() => {
      outputTimer = undefined;
      post({ type: 'output', output });
    }, 40);
  }

  async function openOutputFile(message) {
    if (!outputFolder || !vscode.workspace.isTrusted) return;
    const location = fileLocation(outputFolder.fsPath, message.file, message.line, message.column);
    if (!location) return;
    const uri = outputFolder.with({ path: vscode.Uri.file(location.file).path });
    try {
      const info = await vscode.workspace.fs.stat(uri);
      if (!(info.type & vscode.FileType.File)) throw new Error('Expected a file');
      const document = await vscode.workspace.openTextDocument(uri);
      const position = document.validatePosition(new vscode.Position(location.line, location.column));
      await vscode.window.showTextDocument(document, { selection: new vscode.Range(position, position) });
    } catch {
      void vscode.window.showWarningMessage('Could not open ' + message.file);
    }
  }

  async function readProject(folder) {
    const uri = vscode.Uri.joinPath(folder.uri, 'package.json');
    const project = { id: folder.uri.toString(), label: folder.name, cwd: path.dirname(uri.fsPath),
      scripts: new Set() };
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const json = JSON.parse(Buffer.from(bytes).toString('utf8').replace(/^\uFEFF/, ''));
      project.scripts = new Set(Object.entries(json?.scripts ?? {})
        .filter(([, command]) => typeof command === 'string').map(([name]) => name));
    } catch (error) {
      if (error.code === 'FileNotFound') return undefined;
      project.error = 'Could not read package.json: ' + error.message;
    }
    return project;
  }

  async function refresh() {
    const version = ++refreshVersion;
    const folders = vscode.workspace.workspaceFolders ?? [];
    const packages = await Promise.all(folders.map(readProject));
    if (version !== refreshVersion) return;
    projects = new Map(packages.filter(Boolean).map(project => [project.id, project]));
    state();
  }

  function finish(job, result) {
    if (current !== job) return;
    current = undefined;
    status = result;
    state();
  }

  async function start(id, name) {
    if (current || !vscode.workspace.isTrusted || typeof name !== 'string') return;
    const folder = vscode.workspace.workspaceFolders?.find(item => item.uri.toString() === id);
    if (!folder || !projects.get(id)?.scripts.has(name)) return;

    const job = {};
    current = job;
    outputFolder = folder.uri;
    status = 'Starting ' + name + '…';
    output = '';
    append('');
    state();

    try {
      const project = await readProject(folder);
      if (!project?.scripts.has(name)) {
        finish(job, 'Script is no longer available.');
        await refresh();
        return;
      }
      const command = await npmCommand();
      if (current !== job) return;
      const child = run(command, project.cwd, name);
      job.child = child;
      status = 'Running ' + name;
      state();
      for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding('utf8').on('data', chunk => append(chunk));
      }
      child.once('error', error => {
        append(error.message + '\n');
        finish(job, 'Could not start npm.');
      });
      child.once('close', (code, signal) => {
        const result = job.stopping || signal ? 'Stopped'
          : code === 0 ? 'Finished successfully' : 'Failed (exit ' + code + ')';
        finish(job, result);
      });
    } catch (error) {
      append(error.message + '\n');
      finish(job, 'Could not start npm.');
    }
  }

  async function stopCurrent() {
    const job = current;
    if (!job?.child || job.stopping) return;
    job.stopping = true;
    try {
      await stop(job.child);
    } catch (error) {
      if (current !== job) return;
      job.stopping = false;
      append('Could not stop: ' + error.message + '\n');
    }
  }

  const watcher = vscode.workspace.createFileSystemWatcher('package.json');
  context.subscriptions.push(watcher, watcher.onDidChange(refresh),
    watcher.onDidCreate(refresh), watcher.onDidDelete(refresh),
    vscode.workspace.onDidChangeWorkspaceFolders(refresh),
    { dispose: () => {
      clearTimeout(outputTimer);
      const job = current;
      current = undefined;
      void stop(job?.child).catch(() => {});
    } },
    vscode.window.registerWebviewViewProvider('npmRunButtons.scripts', {
      resolveWebviewView(nextView) {
        view = nextView;
        const media = vscode.Uri.joinPath(context.extensionUri, 'media');
        const webview = view.webview;
        webview.options = { enableScripts: true, localResourceRoots: [media] };
        const resource = name => webview.asWebviewUri(vscode.Uri.joinPath(media, name));
        const messages = webview.onDidReceiveMessage(message => {
          if (message?.type === 'ready') {
            post({ type: 'output', output });
            void refresh();
          } else if (message?.type === 'run') {
            void start(message.id, message.name);
          } else if (message?.type === 'stop') {
            void stopCurrent();
          } else if (message?.type === 'openFile') {
            void openOutputFile(message);
          } else if (message?.type === 'clear') {
            output = '';
            append('');
          }
        });
        nextView.onDidDispose(() => {
          messages.dispose();
          if (view === nextView) view = undefined;
        });
        webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
<link rel="stylesheet" href="${resource('sidebar.css')}">
</head>
<body>
<div id="projects"></div>
<section aria-label="Run output">
  <div class="toolbar">
    <span id="status" role="status">Ready</span>
    <button class="icon-button" id="stop" type="button" aria-label="Stop script" title="Stop script" disabled><span class="icon stop" aria-hidden="true"></span></button>
    <button class="icon-button" id="clear" type="button" aria-label="Clear output" title="Clear output"><span class="icon clear" aria-hidden="true"></span></button>
  </div>
  <pre id="output" aria-label="Output" tabindex="0"></pre>
</section>
<script src="${resource('terminal.js')}"></script>
<script src="${resource('sidebar.js')}"></script>
</body>
</html>`;
      }
    }));
}

module.exports = { activate };
