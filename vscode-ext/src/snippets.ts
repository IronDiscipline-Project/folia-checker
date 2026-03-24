import * as vscode from 'vscode';

interface FoliaSnippet {
  label: string;
  detail: string;
  insertText: string;
  documentation: string;
}

const FOLIA_SNIPPETS: FoliaSnippet[] = [
  {
    label: 'folia-global-run',
    detail: 'Folia: GlobalRegionScheduler.run',
    insertText: [
      'Bukkit.getGlobalRegionScheduler().run(${1:plugin}, task -> {',
      '    $0',
      '});',
    ].join('\n'),
    documentation:
      'グローバルリージョンスケジューラーでタスクを即座に実行します。\n場所に依存しないグローバル処理に使用します。',
  },
  {
    label: 'folia-global-delayed',
    detail: 'Folia: GlobalRegionScheduler.runDelayed',
    insertText: [
      'Bukkit.getGlobalRegionScheduler().runDelayed(${1:plugin}, task -> {',
      '    $0',
      '}, ${2:20L});',
    ].join('\n'),
    documentation:
      'グローバルリージョンスケジューラーで遅延タスクを実行します。\n第3引数は遅延tick数です。',
  },
  {
    label: 'folia-global-fixedrate',
    detail: 'Folia: GlobalRegionScheduler.runAtFixedRate',
    insertText: [
      'Bukkit.getGlobalRegionScheduler().runAtFixedRate(${1:plugin}, task -> {',
      '    $0',
      '}, ${2:1L}, ${3:20L});',
    ].join('\n'),
    documentation:
      'グローバルリージョンスケジューラーで定期タスクを実行します。\n第3引数は初回遅延、第4引数は間隔（tick）です。',
  },
  {
    label: 'folia-async-run',
    detail: 'Folia: AsyncScheduler.runNow',
    insertText: [
      'Bukkit.getAsyncScheduler().runNow(${1:plugin}, task -> {',
      '    $0',
      '});',
    ].join('\n'),
    documentation:
      '非同期スケジューラーでタスクを即座に実行します。\nI/O・DB・ネットワーク処理に使用します。ワールドアクセスは禁止です。',
  },
  {
    label: 'folia-async-delayed',
    detail: 'Folia: AsyncScheduler.runDelayed',
    insertText: [
      'Bukkit.getAsyncScheduler().runDelayed(${1:plugin}, task -> {',
      '    $0',
      '}, ${2:5L}, ${3:TimeUnit.SECONDS});',
    ].join('\n'),
    documentation:
      '非同期スケジューラーで遅延タスクを実行します。\nTimeUnit で時間単位を指定します。',
  },
  {
    label: 'folia-async-fixedrate',
    detail: 'Folia: AsyncScheduler.runAtFixedRate',
    insertText: [
      'Bukkit.getAsyncScheduler().runAtFixedRate(${1:plugin}, task -> {',
      '    $0',
      '}, ${2:0L}, ${3:10L}, ${4:TimeUnit.SECONDS});',
    ].join('\n'),
    documentation:
      '非同期スケジューラーで定期タスクを実行します。\n初回遅延、間隔、TimeUnit を指定します。',
  },
  {
    label: 'folia-entity-run',
    detail: 'Folia: EntityScheduler.run',
    insertText: [
      '${1:entity}.getScheduler().run(${2:plugin}, task -> {',
      '    $0',
      '}, null);',
    ].join('\n'),
    documentation:
      'エンティティのリージョンスレッドでタスクを実行します。\n第3引数はエンティティが削除済みの場合のフォールバック（nullで無視）。',
  },
  {
    label: 'folia-entity-delayed',
    detail: 'Folia: EntityScheduler.runDelayed',
    insertText: [
      '${1:entity}.getScheduler().runDelayed(${2:plugin}, task -> {',
      '    $0',
      '}, null, ${3:20L});',
    ].join('\n'),
    documentation:
      'エンティティのリージョンスレッドで遅延タスクを実行します。',
  },
  {
    label: 'folia-region-run',
    detail: 'Folia: RegionScheduler.run',
    insertText: [
      'Bukkit.getRegionScheduler().run(${1:plugin}, ${2:location}, task -> {',
      '    $0',
      '});',
    ].join('\n'),
    documentation:
      '指定座標のリージョンスレッドでタスクを実行します。\nチャンク操作やブロック操作に使用します。',
  },
  {
    label: 'folia-region-delayed',
    detail: 'Folia: RegionScheduler.runDelayed',
    insertText: [
      'Bukkit.getRegionScheduler().runDelayed(${1:plugin}, ${2:location}, task -> {',
      '    $0',
      '}, ${3:20L});',
    ].join('\n'),
    documentation:
      '指定座標のリージョンスレッドで遅延タスクを実行します。',
  },
  {
    label: 'folia-teleport-async',
    detail: 'Folia: teleportAsync',
    insertText: [
      '${1:entity}.teleportAsync(${2:location}).thenAccept(success -> {',
      '    if (success) {',
      '        $0',
      '    }',
      '});',
    ].join('\n'),
    documentation:
      '非同期テレポートを実行します。\nCompletableFuture<Boolean> を返し、テレポート成功/失敗をコールバックで処理できます。',
  },
  {
    label: 'folia-check-supported',
    detail: 'Folia: Folia対応チェック',
    insertText: [
      'private boolean isFolia() {',
      '    try {',
      '        Class.forName("io.papermc.paper.threadedregions.RegionizedServer");',
      '        return true;',
      '    } catch (ClassNotFoundException e) {',
      '        return false;',
      '    }',
      '}',
    ].join('\n'),
    documentation:
      '実行環境が Folia かどうかを判定するユーティリティメソッドです。\nFolia と Paper/Bukkit の両方をサポートする場合に使用します。',
  },
];

/**
 * Provides Folia API snippet completions inside Java files.
 * Triggered by typing "folia" or via Ctrl+Space.
 */
export class FoliaSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // Only suggest when user types something relevant
    if (!/folia|Bukkit|scheduler|teleport/i.test(linePrefix) && linePrefix.trim().length > 0) {
      return [];
    }

    return FOLIA_SNIPPETS.map((snippet) => {
      const item = new vscode.CompletionItem(
        snippet.label,
        vscode.CompletionItemKind.Snippet,
      );
      item.detail = snippet.detail;
      item.insertText = new vscode.SnippetString(snippet.insertText);
      item.documentation = new vscode.MarkdownString(snippet.documentation);
      item.sortText = `0_${snippet.label}`; // prioritise Folia snippets
      return item;
    });
  }
}
