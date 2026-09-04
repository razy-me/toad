/**
 * Language Server Protocol (LSP) Server for toad.
 *
 * Zero-dependency stdio JSON-RPC implementation: a VS Code extension client
 * (or any LSP host) spawns this script and speaks standard LSP over stdin/
 * stdout. Supported capabilities:
 *   - full-file diagnostics (parser + linter) pushed on open/change
 *   - hover information for variables, element ids and known properties
 *   - go-to-definition for variable references (>${name})
 *   - context-aware completion (properties + declared variables)
 */

import { Parser } from '../../parser/parser.js';
import { lintDocument } from '../linter.js';
import { KNOWN_PROPERTIES } from '../diagnostics.js';
import { Lexer } from '../../parser/lexer.js';

type Diagnostic = any;

interface VarDeclInfo {
  name: string;
  line: number; // 1-based
  column: number; // 1-based
  valuePreview: string;
}

export class ToadLanguageServer {
  private documents: Map<string, string> = new Map();

  /** Re-parses the document and pushes diagnostics to the client. */
  public async validateTextDocument(uri: string, text: string): Promise<Diagnostic[]> {
    this.documents.set(uri, text);
    const lexer = new Lexer(text, uri);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, uri);
    const diagnostics: Diagnostic[] = [];

    let ast: any;
    try {
      ast = parser.parse();
      for (const d of parser.diagnostics || []) {
        diagnostics.push({
          severity: d.severity === 'warning' ? 2 : 1,
          message: d.message,
          source: 'toad',
          range: toLspRange(d.loc)
        });
      }
    } catch (err: any) {
      diagnostics.push({
        severity: 1,
        message: err.message || 'Parse error',
        source: 'toad',
        range: toLspRange(err.loc)
      });
    }

    if (ast) {
      for (const res of lintDocument(ast)) {
        diagnostics.push({
          severity: res.severity === 'error' ? 1 : 2,
          message: res.message,
          source: 'toad-lint',
          range: toLspRange(res.loc)
        });
      }
    }

    this.sendNotification('textDocument/publishDiagnostics', { uri, diagnostics });
    return diagnostics;
  }

  /** Word (and its 1-based line/column) under an LSP position. */
  private wordAt(uri: string, line0: number, character0: number): { word: string; line: number; column: number } | null {
    const text = this.documents.get(uri);
    if (text == null) return null;
    const lines = text.split(/\r?\n/);
    const row = lines[line0];
    if (row == null) return null;
    let start = Math.min(character0, row.length);
    let end = start;
    const isWordChar = (ch: string) => /[A-Za-z0-9_>.-]/.test(ch);
    while (start > 0 && isWordChar(row[start - 1])) start--;
    while (end < row.length && isWordChar(row[end])) end++;
    if (start === end) return null;
    return { word: row.slice(start, end), line: line0 + 1, column: start + 1 };
  }

  /** Collects top-level variable declarations with their locations. */
  private collectVariables(uri: string): Map<string, VarDeclInfo> {
    const out = new Map<string, VarDeclInfo>();
    const text = this.documents.get(uri);
    if (!text) return out;
    const lines = text.split(/\r?\n/);
    lines.forEach((row, idx) => {
      const m = row.match(/^\s*(?:>)([A-Za-z_][A-Za-z0-9_]*)\s*[=:]\s*(.+?)\s*;/);
      if (m) {
        out.set(m[1], {
          name: m[1],
          line: idx + 1,
          column: (row.length - row.trimStart().length) + 1,
          valuePreview: m[2]
        });
      }
    });
    return out;
  }

  /** Hover: variable declarations/references, ids and known properties. */
  public onHover(uri: string, line: number, character: number): any | null {
    const hit = this.wordAt(uri, line, character);
    if (!hit) return null;
    const bare = hit.word.replace(/^>/, '');

    const vars = this.collectVariables(uri);
    const decl = vars.get(bare);
    if (decl) {
      return {
        contents: { kind: 'markdown', value: `**variable** \`${decl.name}\`\n\n\`\`\`${'toad'}\n${decl.name}: ${decl.valuePreview};\n\`\`\`` },
        range: {
          start: { line: hit.line - 1, character: hit.column - 1 },
          end: { line: hit.line - 1, character: hit.column - 1 + hit.word.length }
        }
      };
    }

    if ((KNOWN_PROPERTIES as string[]).includes(hit.word)) {
      return {
        contents: { kind: 'markdown', value: `**toad property** \`${hit.word}\`` },
        range: {
          start: { line: hit.line - 1, character: hit.column - 1 },
          end: { line: hit.line - 1, character: hit.column - 1 + hit.word.length }
        }
      };
    }
    return null;
  }

  /** Go-to-definition for variable references. */
  public onDefinition(uri: string, line: number, character: number): any | null {
    const hit = this.wordAt(uri, line, character);
    if (!hit || !hit.word.startsWith('>')) return null;
    const bare = hit.word.slice(1);
    const decl = this.collectVariables(uri).get(bare);
    if (!decl) return null;
    return {
      uri,
      range: {
        start: { line: decl.line - 1, character: decl.column - 1 },
        end: { line: decl.line - 1, character: decl.column - 1 + bare.length + 1 }
      }
    };
  }

  /** Context-aware completion: properties plus declared variables. */
  public onCompletion(uri?: string): any[] {
    const items: any[] = KNOWN_PROPERTIES.map(prop => ({
      label: prop,
      kind: 14, // Keyword
      insertText: `${prop}: `
    }));
    if (uri && this.documents.has(uri)) {
      for (const [name] of this.collectVariables(uri)) {
        items.push({ label: `>${name}`, kind: 6 /* Variable */, detail: 'document variable' });
      }
    }
    return items;
  }

  /** Starts the zero-dependency stdio JSON-RPC message loop. */
  public listen(): void {
    let buffer = Buffer.alloc(0);

    const handleMessage = async (msg: any) => {
      const { id, method, params } = msg || {};
      try {
        switch (method) {
          case 'initialize':
            this.respond(id, {
              capabilities: {
                textDocumentSync: 1, // full
                hoverProvider: true,
                definitionProvider: true,
                completionProvider: { triggerCharacters: ['>'] }
              },
              serverInfo: { name: 'toad-lsp', version: '1.0.0' }
            });
            break;
          case 'initialized':
            break;
          case 'shutdown':
            this.respond(id, null);
            break;
          case 'exit':
            process.exit(0);
            break;
          case 'textDocument/didOpen':
            if (params?.textDocument) await this.validateTextDocument(params.textDocument.uri, params.textDocument.text);
            break;
          case 'textDocument/didChange': {
            const td = params?.textDocument;
            const change = params?.contentChanges?.[params.contentChanges.length - 1];
            if (td && change && typeof change.text === 'string') await this.validateTextDocument(td.uri, change.text);
            break;
          }
          case 'textDocument/hover': {
            const pos = params?.position;
            const result = params?.textDocument && pos ? this.onHover(params.textDocument.uri, pos.line ?? 0, pos.character ?? 0) : null;
            this.respond(id, result);
            break;
          }
          case 'textDocument/definition': {
            const pos = params?.position;
            const result = params?.textDocument && pos ? this.onDefinition(params.textDocument.uri, pos.line ?? 0, pos.character ?? 0) : null;
            this.respond(id, result);
            break;
          }
          case 'textDocument/completion':
            this.respond(id, this.onCompletion(params?.textDocument?.uri));
            break;
          default:
            if (id !== undefined) this.respond(id, null);
        }
      } catch (err: any) {
        if (id !== undefined) this.sendError(id, -32603, err?.message || String(err));
      }
    };

    process.stdin.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) break;
        const header = buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = Buffer.alloc(0);
          break;
        }
        const length = parseInt(match[1], 10);
        const total = headerEnd + 4 + length;
        if (buffer.length < total) break;
        const body = buffer.slice(headerEnd + 4, total).toString('utf8');
        buffer = buffer.slice(total);
        try {
          void handleMessage(JSON.parse(body));
        } catch { /* malformed JSON: skip */ }
      }
    });
    process.stdin.resume();
    console.error('[toad-lsp] Language Server listening...');
  }

  private send(method: string, params: any): void {
    const payload = JSON.stringify({ jsonrpc: '2.0', method, params });
    process.stdout.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
  }

  private sendNotification(method: string, params: any): void {
    this.send(method, params);
  }

  private respond(id: any, result: any): void {
    const payload = JSON.stringify({ jsonrpc: '2.0', id, result });
    process.stdout.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
  }

  private sendError(id: any, code: number, message: string): void {
    const payload = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
    process.stdout.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
  }
}

// Standalone entry: `node dist/tools/lsp/server.js`
if (process.argv[1] && /lsp[\\/]server\.js$/.test(process.argv[1].replace(/\\/g, '/'))) {
  new ToadLanguageServer().listen();
}

function toLspRange(loc?: any): { start: { line: number; character: number }; end: { line: number; character: number } } {
  const startLine = Math.max(0, (loc?.start?.line ?? 1) - 1);
  const startChar = Math.max(0, (loc?.start?.column ?? 1) - 1);
  const endLine = Math.max(0, (loc?.end?.line ?? loc?.start?.line ?? 1) - 1);
  const endChar = Math.max(0, loc?.end?.column ?? (startChar + 1));
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar }
  };
}
