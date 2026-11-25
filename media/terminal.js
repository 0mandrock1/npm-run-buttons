const palette = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
const ansi = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;
const filePattern = /[\w+.-]+:\/\/[^\s"'<>]+|(?<![\w.:/\\])(?:"([^"\r\n]+)"|'([^'\r\n]+)'|((?:[A-Za-z]:\\|\/)[^:\r\n()<>"'|?*]*\.[\w-]+(?=:\d|\(\d)|(?:(?:[A-Za-z]:)?[/\\]|\.{1,2}[/\\])?(?:[\w.@+~-]+[/\\])*[\w@+~-]+(?:\.[\w@+~-]+)+))(?::(\d+)(?::(\d+))?|\((\d+)(?:,\s*(\d+))?\))?/gu;

function fileLinks(text) {
  return [...text.matchAll(filePattern)].flatMap(match => {
    const [, doubleQuoted, singleQuoted, bare, line, column, tsLine, tsColumn] = match;
    const file = doubleQuoted ?? singleQuoted ?? bare;
    if (!file || /^[\w+.-]+:\/\//.test(file) || !/[\/\\]|\.[\w-]+$/.test(file)) return [];
    if (!line && !tsLine && !/[\/\\]/.test(file) && !/\.[a-z][a-z0-9]*$/i.test(file)) return [];
    return [{ start: match.index, end: match.index + match[0].length,
      file, line: Number(line ?? tsLine ?? 1), column: Number(column ?? tsColumn ?? 1) }];
  });
}

function terminalColor(index) {
  if (!Number.isInteger(index) || index < 0 || index > 255) return '';
  if (index < 16) {
    const name = (index < 8 ? '' : 'Bright') + palette[index % 8];
    return 'var(--vscode-terminal-ansi' + name + ')';
  }
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10;
    return 'rgb(' + [gray, gray, gray].join(',') + ')';
  }
  const levels = [0, 95, 135, 175, 215, 255];
  const cube = index - 16;
  return 'rgb(' + [levels[Math.floor(cube / 36)], levels[Math.floor(cube / 6) % 6],
    levels[cube % 6]].join(',') + ')';
}

function applySgr(style, sequence) {
  const codes = sequence.slice(2, -1).split(';').flatMap(part =>
    part.includes(':') ? part.replace(/^([34]8):2::/, '$1:2:').split(':').map(Number) : [Number(part)]);
  for (let i = 0; i < codes.length; i++) {
    const value = codes[i];
    if (value === 0) style = {};
    else if (value === 1) style.fontWeight = 'bold';
    else if (value === 2) style.opacity = '.75';
    else if (value === 3) style.fontStyle = 'italic';
    else if (value === 4) style.textDecoration = 'underline';
    else if (value === 22) { delete style.fontWeight; delete style.opacity; }
    else if (value === 23) delete style.fontStyle;
    else if (value === 24) delete style.textDecoration;
    else if (value === 39) delete style.color;
    else if (value === 49) delete style.backgroundColor;
    else if (value >= 30 && value <= 37) style.color = terminalColor(value - 30);
    else if (value >= 40 && value <= 47) style.backgroundColor = terminalColor(value - 40);
    else if (value >= 90 && value <= 97) style.color = terminalColor(value - 82);
    else if (value >= 100 && value <= 107) style.backgroundColor = terminalColor(value - 92);
    else if (value === 38 || value === 48) {
      const property = value === 38 ? 'color' : 'backgroundColor';
      const mode = codes[++i];
      if (mode === 5) style[property] = terminalColor(codes[++i]);
      if (mode === 2) {
        const rgb = codes.slice(i + 1, i + 4);
        i += 3;
        if (rgb.length === 3 && rgb.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
          style[property] = 'rgb(' + rgb.join(',') + ')';
        }
      }
    }
  }
  return style;
}

function terminalText(raw) {
  // Hold an unfinished escape sequence until the next output update.
  raw = raw.replace(/\x1b(?:\[[0-?]*[ -/]*|\][^\x07\x1b]*)?$/, '');
  let offset = 0;
  let style = {};
  let text = '';
  const runs = [];
  function append(end) {
    const chunk = raw.slice(offset, end).replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
    if (!chunk) return;
    runs.push({ start: text.length, end: text.length + chunk.length, style: { ...style } });
    text += chunk;
  }
  for (const match of raw.matchAll(ansi)) {
    append(match.index);
    if (/^\x1b\[[\d;:]*m$/.test(match[0])) style = applySgr(style, match[0]);
    offset = match.index + match[0].length;
  }
  append(raw.length);
  return { text, runs, links: fileLinks(text) };
}

function renderTerminal(output, raw, openFile) {
  const { text, runs, links } = terminalText(raw);
  const fragment = document.createDocumentFragment();
  let runIndex = 0;
  let offset = 0;

  function append(parent, end) {
    while (offset < end) {
      const run = runs[runIndex];
      const next = Math.min(end, run.end);
      let node = document.createTextNode(text.slice(offset, next));
      if (Object.keys(run.style).length) {
        const span = document.createElement('span');
        Object.assign(span.style, run.style);
        span.append(node);
        node = span;
      }
      parent.append(node);
      offset = next;
      if (offset === run.end) runIndex++;
    }
  }

  for (const link of links) {
    append(fragment, link.start);
    const anchor = document.createElement('a');
    anchor.href = '#';
    anchor.title = 'Open ' + link.file;
    anchor.onclick = event => {
      event.preventDefault();
      openFile(link);
    };
    append(anchor, link.end);
    fragment.append(anchor);
  }
  append(fragment, text.length);
  output.replaceChildren(fragment);
}

if (typeof module !== 'undefined') module.exports = { terminalText };
