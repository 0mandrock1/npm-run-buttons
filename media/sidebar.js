const vscode = acquireVsCodeApi();
const projects = document.querySelector('#projects');
const output = document.querySelector('#output');
const status = document.querySelector('#status');
const stop = document.querySelector('#stop');

stop.onclick = () => vscode.postMessage({ type: 'stop' });
document.querySelector('#clear').onclick = () => vscode.postMessage({ type: 'clear' });

window.addEventListener('message', ({ data }) => {
  if (data.type === 'output') {
    const follow = output.scrollHeight - output.scrollTop - output.clientHeight < 24;
    renderTerminal(output, data.output, link => vscode.postMessage({ type: 'openFile', ...link }));
    if (follow) output.scrollTop = output.scrollHeight;
    return;
  }
  if (data.type !== 'state') return;
  status.textContent = data.status || 'Ready';
  stop.disabled = !data.canStop;

  const focused = document.activeElement;
  projects.replaceChildren();
  if (!data.projects.length) projects.textContent = 'Open a folder with a package.json.';
  for (const project of data.projects) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = project.label;
    if (data.projects.length > 1) section.append(heading);
    const scripts = document.createElement('div');
    scripts.className = 'scripts';
    if (!project.scripts.length) scripts.textContent = project.error || 'No npm scripts.';
    for (const name of project.scripts) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'run-button';
      button.title = 'Run ' + name;
      const icon = document.createElement('span');
      icon.className = 'icon play';
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon, document.createTextNode(name));
      button.dataset.project = project.id;
      button.dataset.script = name;
      button.disabled = data.busy;
      button.onclick = () => vscode.postMessage({ type: 'run', id: project.id, name });
      scripts.append(button);
    }
    section.append(scripts);
    projects.append(section);
  }
  if (focused?.dataset.project) {
    [...projects.querySelectorAll('button')].find(button =>
      button.dataset.project === focused.dataset.project &&
      button.dataset.script === focused.dataset.script)?.focus();
  }
});

vscode.postMessage({ type: 'ready' });
