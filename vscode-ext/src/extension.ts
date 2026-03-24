import * as vscode from 'vscode';
import { DiagnosticProvider } from './diagnostics';
import { FoliaHoverProvider } from './hover';
import { FoliaCodeActionProvider } from './codeactions';
import { FoliaSnippetProvider } from './snippets';
import { analyzeContent, analyzeFile, generateMigrationReport, formatMigrationReport } from '@foliachecker/shared';
import type { AnalysisResult } from '@foliachecker/shared';

let diagnosticProvider: DiagnosticProvider;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticProvider = new DiagnosticProvider();

  const javaSelector: vscode.DocumentSelector = { language: 'java', scheme: 'file' };

  // ─── Hover Provider ──────────────────────────────────────────────────────────
  const hoverDisposable = vscode.languages.registerHoverProvider(
    javaSelector,
    new FoliaHoverProvider(),
  );

  // ─── Code Action Provider (Quick Fix) ────────────────────────────────────────
  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    javaSelector,
    new FoliaCodeActionProvider(),
    { providedCodeActionKinds: FoliaCodeActionProvider.providedCodeActionKinds },
  );

  // ─── Snippet Completion Provider ─────────────────────────────────────────────
  const snippetDisposable = vscode.languages.registerCompletionItemProvider(
    javaSelector,
    new FoliaSnippetProvider(),
    'f', 'B', 's', 't', // trigger characters
  );

  // ─── Document Event Handlers ─────────────────────────────────────────────────
  const openDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
    diagnosticProvider.analyzeDocument(doc);
  });

  const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    diagnosticProvider.analyzeDocument(doc);
  });

  const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    diagnosticProvider.onDocumentChange(event);
  });

  // ファイルを閉じたら、ディスク上の内容で再解析（unsaved changes を破棄した状態に戻す）
  const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    if (doc.uri.scheme === 'file' && doc.languageId === 'java') {
      diagnosticProvider.analyzeFilePath(doc.uri);
    }
  });

  // ワークスペースの .java ファイルの追加・変更・削除を監視
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.java');
  watcher.onDidCreate((uri) => diagnosticProvider.analyzeFilePath(uri));
  watcher.onDidChange((uri) => {
    const isOpen = vscode.workspace.textDocuments.some(
      (d) => d.uri.toString() === uri.toString(),
    );
    if (!isOpen) diagnosticProvider.analyzeFilePath(uri);
  });
  watcher.onDidDelete((uri) => {
    diagnosticProvider.clearDocument(uri);
  });

  // 設定変更時に全ファイルを再スキャン
  const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('foliaChecker')) {
      diagnosticProvider.reloadAll();
    }
  });

  // ─── Commands ────────────────────────────────────────────────────────────────

  // 手動再スキャンコマンド
  const scanCommand = vscode.commands.registerCommand(
    'folia-checker.scanWorkspace',
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Folia Checker: ワークスペースを解析中...',
          cancellable: false,
        },
        async () => {
          await diagnosticProvider.analyzeWorkspace();
        },
      );
      vscode.window.showInformationMessage('Folia Checker: ワークスペースの解析が完了しました。');
    },
  );

  // 移行レポートコマンド
  const reportCommand = vscode.commands.registerCommand(
    'folia-checker.migrationReport',
    async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Folia Checker: 移行レポートを生成中...',
          cancellable: false,
        },
        async () => {
          const uris = await vscode.workspace.findFiles(
            '**/*.java',
            '{**/node_modules/**,**/build/**,**/target/**}',
          );

          const results: AnalysisResult[] = [];
          for (const uri of uris) {
            const openDoc = vscode.workspace.textDocuments.find(
              (d) => d.uri.toString() === uri.toString(),
            );
            if (openDoc) {
              results.push(analyzeContent(openDoc.getText(), uri.fsPath));
            } else {
              results.push(analyzeFile(uri.fsPath));
            }
          }

          const report = generateMigrationReport(results);
          const formatted = formatMigrationReport(report);

          const channel = vscode.window.createOutputChannel('Folia Migration Report');
          channel.clear();
          channel.appendLine(formatted);
          channel.show(true);
        },
      );
    },
  );

  // 全 Quick Fix を一括適用するコマンド
  const fixAllCommand = vscode.commands.registerCommand(
    'folia-checker.fixAll',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'java') {
        vscode.window.showWarningMessage('Folia Checker: Java ファイルを開いてください。');
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
        .filter((d) => d.source === 'Folia Checker');

      if (diagnostics.length === 0) {
        vscode.window.showInformationMessage('Folia Checker: このファイルに修正可能な問題はありません。');
        return;
      }

      const { FOLIA_RULES } = await import('@foliachecker/shared');
      const edit = new vscode.WorkspaceEdit();
      let fixCount = 0;

      // Apply fixes in reverse order to preserve line positions
      const sortedDiags = [...diagnostics].sort(
        (a, b) => b.range.start.line - a.range.start.line || b.range.start.character - a.range.start.character,
      );

      for (const diagnostic of sortedDiags) {
        const rule = FOLIA_RULES.find((r) => r.id === diagnostic.code);
        if (!rule?.quickFix) continue;

        const lineText = editor.document.lineAt(diagnostic.range.start.line).text;
        const matchedPortion = lineText.substring(
          diagnostic.range.start.character,
          diagnostic.range.end.character,
        );

        for (const fix of rule.quickFix) {
          const fixPattern = new RegExp(fix.pattern);
          if (!fixPattern.test(matchedPortion)) continue;

          const replaced = matchedPortion.replace(fixPattern, fix.replacement);
          edit.replace(editor.document.uri, diagnostic.range, replaced);
          fixCount++;
          break;
        }
      }

      if (fixCount > 0) {
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(
          `Folia Checker: ${fixCount} 件の問題を自動修正しました。`,
        );
      } else {
        vscode.window.showInformationMessage(
          'Folia Checker: 自動修正可能な問題はありませんでした。',
        );
      }
    },
  );

  // 起動時にワークスペース全体をスキャン
  diagnosticProvider.analyzeWorkspace();

  context.subscriptions.push(
    diagnosticProvider.collection,
    hoverDisposable,
    codeActionDisposable,
    snippetDisposable,
    openDisposable,
    saveDisposable,
    changeDisposable,
    closeDisposable,
    watcher,
    configDisposable,
    scanCommand,
    reportCommand,
    fixAllCommand,
  );
}

export function deactivate(): void {
  diagnosticProvider?.collection.dispose();
}
