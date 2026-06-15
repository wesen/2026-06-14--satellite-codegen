export class CppWriter {
  constructor({ indentText = '  ' } = {}) {
    this.indentText = indentText;
    this.indentLevel = 0;
    this.lines = [];
  }

  indent() {
    this.indentLevel += 1;
  }

  dedent() {
    if (this.indentLevel === 0) {
      throw new Error('Cannot dedent below zero');
    }
    this.indentLevel -= 1;
  }

  line(text = '') {
    const prefix = this.indentText.repeat(this.indentLevel);
    const parts = String(text).split('\n');
    for (const part of parts) {
      this.lines.push(part.length > 0 ? `${prefix}${part}` : '');
    }
  }

  block(header, body) {
    this.line(`${header} {`);
    this.indent();
    body();
    this.dedent();
    this.line('}');
  }

  toString() {
    return `${this.lines.join('\n')}\n`;
  }
}
