import * as path from 'path';
import * as vscode from 'vscode';
import { analyzeContent, analyzeFile, isBukkitProject } from '@foliachecker/shared';
import type { Violation } from '@foliachecker/shared';

function getConfig() {
  return vscode.workspace.getConfiguration('foliaChecker');
}

export class DiagnosticProvider {
  public readonly collection: vscode.DiagnosticCollection;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** ワークスペースフォルダごとの Bukkit 系プロジェクト判定キャッシュ */
  private readonly projectCache = new Map<string, boolean>();

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('folia-checker');
  }

  /** ファイルパスが Bukkit 系プロジェクト配下かどうかをキャッシュ付きで判定 */
  private isBukkitFile(fsPath: string): boolean {
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
    const cacheKey = folder ? folder.uri.fsPath : path.dirname(fsPath);
    if (!this.projectCache.has(cacheKey)) {
      this.projectCache.set(cacheKey, isBukkitProject(cacheKey));
    }
    return this.projectCache.get(cacheKey)!;
  }

  // 開いているドキュメントを解析（編集中の内容をリアルタイムで反映）
  analyzeDocument(document: vscode.TextDocument): void {
    if (!this.isTargetDocument(document)) return;
    if (!getConfig().get<boolean>('enable', true)) return;
    if (!this.isBukkitFile(document.uri.fsPath)) return;

    const result = analyzeContent(document.getText(), document.uri.fsPath);
    const diagnostics = result.violations.map((v) =>
      this.violationToDiagnostic(v, document.uri),
    );
    this.collection.set(document.uri, diagnostics);
  }

  // ディスク上のファイルを直接解析（エディタで開いていないファイル用）
  analyzeFilePath(uri: vscode.Uri): void {
    if (!getConfig().get<boolean>('enable', true)) return;
    if (!this.isBukkitFile(uri.fsPath)) return;

    const result = analyzeFile(uri.fsPath);
    if (result.error) return;
    const diagnostics = result.violations.map((v) =>
      this.violationToDiagnostic(v, uri),
    );
    this.collection.set(uri, diagnostics);
  }

  // ワークスペース内の全 .java ファイルを解析
  async analyzeWorkspace(): Promise<void> {
    if (!getConfig().get<boolean>('enable', true)) return;

    const uris = await vscode.workspace.findFiles(
      '**/*.java',
      '{**/node_modules/**,**/build/**,**/target/**}',
    );

    for (const uri of uris) {
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

    const debounceMs = getConfig().get<number>('debounceMs', 400);
    const key = event.document.uri.toString();
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer !== undefined) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.analyzeDocument(event.document);
      this.debounceTimers.delete(key);
    }, debounceMs);

    this.debounceTimers.set(key, timer);
  }

  clearDocument(uri: vscode.Uri): void {
    this.collection.delete(uri);
    const key = uri.toString();
    const timer = this.debounceTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }
  }

  // 全診断をクリアして再スキャン（設定変更時に使用）
  async reloadAll(): Promise<void> {
    this.collection.clear();
    this.projectCache.clear();
    await this.analyzeWorkspace();
  }

  private isTargetDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'java' && document.uri.scheme === 'file';
  }

  private violationToDiagnostic(v: Violation, uri: vscode.Uri): vscode.Diagnostic {
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
