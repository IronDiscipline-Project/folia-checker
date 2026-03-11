import * as vscode from 'vscode';
import { DiagnosticProvider } from './diagnostics';
import { FoliaHoverProvider } from './hover';

let diagnosticProvider: DiagnosticProvider;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticProvider = new DiagnosticProvider();

  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'java', scheme: 'file' },
    new FoliaHoverProvider(),
  );

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

  // 起動時にワークスペース全体をスキャン
  diagnosticProvider.analyzeWorkspace();

  context.subscriptions.push(
    diagnosticProvider.collection,
    hoverDisposable,
    openDisposable,
    saveDisposable,
    changeDisposable,
    closeDisposable,
    watcher,
    configDisposable,
    scanCommand,
  );
}

export function deactivate(): void {
  diagnosticProvider?.collection.dispose();
}
