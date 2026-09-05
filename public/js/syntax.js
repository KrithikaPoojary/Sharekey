/**
 * ShareKey Syntax Highlighter & Markdown Parser
 * Minimalist zero-dependency code formatter and tokenizer
 */

const ShareSyntax = {
  escape(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  highlight(code, type) {
    if (!code) return '';
    const safe = this.escape(code);

    if (type.includes('json')) {
      return this.highlightJSON(safe);
    }
    if (type.includes('javascript') || type.includes('typescript')) {
      return this.highlightJS(safe);
    }
    if (type.includes('python')) {
      return this.highlightPython(safe);
    }
    if (type.includes('sql')) {
      return this.highlightSQL(safe);
    }
    if (type.includes('env')) {
      return this.highlightEnv(safe);
    }
    if (type.includes('markdown')) {
      return this.renderMarkdown(safe);
    }

    return this.addLineNumbers(safe);
  },

  highlightJSON(json) {
    const formatted = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'syn-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'syn-key';
        } else {
          cls = 'syn-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'syn-bool';
      } else if (/null/.test(match)) {
        cls = 'syn-null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
    return this.addLineNumbers(formatted);
  },

  highlightJS(code) {
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|new|try|catch|throw|switch|case|default|typeof|instanceof)\b/g;
    const booleans = /\b(true|false|null|undefined)\b/g;
    const strings = /(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g;
    const comments = /(\/\/.*?$|\/\*[\s\S]*?\*\/)/gm;
    const numbers = /\b(\d+(\.\d+)?)\b/g;

    let out = code
      .replace(comments, '<span class="syn-comment">$1</span>')
      .replace(strings, '<span class="syn-string">$1</span>')
      .replace(keywords, '<span class="syn-keyword">$1</span>')
      .replace(booleans, '<span class="syn-bool">$1</span>')
      .replace(numbers, '<span class="syn-number">$1</span>');

    return this.addLineNumbers(out);
  },

  highlightPython(code) {
    const keywords = /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|raise|with|as|pass|lambda|yield|global|nonlocal|async|await)\b/g;
    const booleans = /\b(True|False|None)\b/g;
    const comments = /(#.*?$)/gm;
    const strings = /(&quot;.*?&quot;|&#039;.*?&#039;)/g;
    const numbers = /\b(\d+(\.\d+)?)\b/g;

    let out = code
      .replace(comments, '<span class="syn-comment">$1</span>')
      .replace(strings, '<span class="syn-string">$1</span>')
      .replace(keywords, '<span class="syn-keyword">$1</span>')
      .replace(booleans, '<span class="syn-bool">$1</span>')
      .replace(numbers, '<span class="syn-number">$1</span>');

    return this.addLineNumbers(out);
  },

  highlightSQL(code) {
    const keywords = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|LIMIT|CREATE|TABLE|DROP|ALTER|PRIMARY KEY|INTO|VALUES|AND|OR|NOT|AS|SET)\b/gi;
    const strings = /(&quot;.*?&quot;|&#039;.*?&#039;)/g;
    const comments = /(--.*?$)/gm;

    let out = code
      .replace(comments, '<span class="syn-comment">$1</span>')
      .replace(strings, '<span class="syn-string">$1</span>')
      .replace(keywords, '<span class="syn-keyword">$1</span>');

    return this.addLineNumbers(out);
  },

  highlightEnv(code) {
    const comments = /(#.*?$)/gm;
    const keys = /^([A-Z0-9_-]+)=/gm;

    let out = code
      .replace(comments, '<span class="syn-comment">$1</span>')
      .replace(keys, '<span class="syn-key">$1</span>=');

    return this.addLineNumbers(out);
  },

  renderMarkdown(md) {
    let out = md
      .replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code class="md-inline-code">$1</code>')
      .replace(/\n/gim, '<br>');

    return `<div class="markdown-body">${out}</div>`;
  },

  addLineNumbers(html) {
    const lines = html.split('\n');
    return lines
      .map((line, idx) => `<div class="code-line"><span class="line-number">${idx + 1}</span><span class="line-content">${line || ' '}</span></div>`)
      .join('');
  }
};

window.ShareSyntax = ShareSyntax;
