import * as vscode from 'vscode';
import { analyzeContent, analyzeFile } from '@foliachecker/shared';
import type { Violation } from '@foliachecker/shared';

const DEBOUNCE_MS = 400;

export class DiagnosticProvider {
  public readonly collection: vscode.DiagnosticCollection;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('folia-checker');
  }

  // 開いているドキュメントを解析（編集中の内容をリアルタイムで反映）
  analyzeDocument(document: vscode.TextDocument): void {
    if (!this.isTargetDocument(document)) return;

    const result = analyzeContent(document.getText(), document.uri.fsPath);
    const diagnostics = result.violations.map((v) =>
      this.violationToDiagnostic(v, document.uri),
    );
    this.collection.set(document.uri, diagnostics);
  }

  // ディスク上のファイルを直接解析（エディタで開いていないファイル用）
  analyzeFilePath(uri: vscode.Uri): void {
    const result = analyzeFile(uri.fsPath);
    if (result.error) return;
    const diagnostics = result.violations.map((v) =>
      this.violationToDiagnostic(v, uri),
    );
    this.collection.set(uri, diagnostics);
  }

  // ワークスペース内の全 .java ファイルを解析
  async analyzeWorkspace(): Promise<void> {
    const uris = await vscode.workspace.findFiles(
      '**/*.java',
      '{**/node_modules/**,**/build/**,**/target/**}',
    );

    for (const uri of uris) {
      // 既に開いているファイルは document.getText() で解析（編集中の内容を優先）
      const openDoc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString(),
      );
      if (openDoc) {
        this.analyzeDocument(openDoc);
      } else {
        this.analyzeFilePath(uri);
      }
    }
  }

  onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.isTargetDocument(event.document)) return;

    const key = event.document.uri.toString();
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer !== undefined) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.analyzeDocument(event.document);
      this.debounceTimers.delete(key);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  clearDocument(document: vscode.TextDocument): void {
    this.collection.delete(document.uri);
    const key = document.uri.toString();
    const timer = this.debounceTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }
  }

  private isTargetDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'java' && document.uri.scheme === 'file';
  }

  private violationToDiagnostic(v: Violation, uri: vscode.Uri): vscode.Diagnostic {
    // VS Code Range は 0-based。Violation.line は 1-based なので -1 する
    const range = new vscode.Range(
      v.line - 1, v.column,
      v.line - 1, v.endColumn,
    );

    const severity =
      v.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(range, v.message, severity);
    diagnostic.source = 'Folia Checker';
    diagnostic.code = v.ruleId;

    diagnostic.relatedInformation = [
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(uri, range),
        `修正方法: ${v.fixSuggestion}`,
      ),
    ];

    return diagnostic;
  }
}
