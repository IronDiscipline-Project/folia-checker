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

  // 開いたとき（エディタ内の内容を解析）
  const openDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
    diagnosticProvider.analyzeDocument(doc);
  });

  // 保存時
  const saveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
    diagnosticProvider.analyzeDocument(doc);
  });

  // 編集中（デバウンス付き）
  const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    diagnosticProvider.onDocumentChange(event);
  });

  // ワークスペースの .java ファイルの追加・変更・削除を監視
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.java');
  watcher.onDidCreate((uri) => diagnosticProvider.analyzeFilePath(uri));
  watcher.onDidChange((uri) => {
    // 開いているファイルは onDidChangeTextDocument で処理済みなのでスキップ
    const isOpen = vscode.workspace.textDocuments.some(
      (d) => d.uri.toString() === uri.toString(),
    );
    if (!isOpen) diagnosticProvider.analyzeFilePath(uri);
  });
  watcher.onDidDelete((uri) => {
    diagnosticProvider.collection.delete(uri);
  });

  // 手動でワークスペース全体を再スキャンするコマンド
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
    watcher,
    scanCommand,
  );
}

export function deactivate(): void {
  diagnosticProvider?.collection.dispose();
}
