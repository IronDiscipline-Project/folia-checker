import * as vscode from 'vscode';
import type { RuleId } from '@foliachecker/shared';

const HOVER_DOCS: Record<RuleId, string> = {
  BUKKIT_SCHEDULER: [
    '**Folia Checker** — `BUKKIT_SCHEDULER`',
    '',
    '**問題の説明:**',
    'Folia はリージョンスレッドモデルを採用しており、グローバルな「メインスレッド」は存在しません。',
    '`BukkitScheduler` はメインスレッドの存在を前提としており、Folia では動作しません。',
    '',
    '**代替スケジューラー:**',
    '| 用途 | Folia スケジューラー |',
    '|---|---|',
    '| グローバルタスク | `Bukkit.getGlobalRegionScheduler()` |',
    '| I/O・DB（ワールドアクセスなし） | `Bukkit.getAsyncScheduler()` |',
    '| エンティティに紐づくタスク | `entity.getScheduler()` |',
    '| 座標に紐づくタスク | `location.getRegionScheduler()` |',
  ].join('\n'),

  BUKKIT_RUNNABLE: [
    '**Folia Checker** — `BUKKIT_RUNNABLE`',
    '',
    '**問題の説明:**',
    '`BukkitRunnable` は内部で `BukkitScheduler` のメソッドを呼び出します。',
    '`runTask`, `runTaskLater`, `runTaskTimer` は Folia では削除されています。',
    '',
    '**修正方法:**',
    'ラムダを Folia スケジューラーに渡す形に書き換えてください:',
    '```java',
    '// Before:  new BukkitRunnable() { ... }.runTaskLater(plugin, 20L)',
    'Bukkit.getGlobalRegionScheduler().runDelayed(plugin, task -> {',
    '    // your code here',
    '}, 20L);',
    '```',
  ].join('\n'),

  SYNC_SCHEDULER_METHODS: [
    '**Folia Checker** — `SYNC_SCHEDULER_METHODS`',
    '',
    '**問題の説明:**',
    '`runTask`, `runTaskLater`, `runTaskTimer` は Folia で削除された同期スケジューラーメソッドです。',
    'グローバルなメインスレッドが存在しないためです。',
    '',
    '**修正方法:**',
    '```java',
    '// runTask  →  globalRegionScheduler.run',
    'Bukkit.getGlobalRegionScheduler().run(plugin, task -> { ... });',
    '',
    '// runTaskLater  →  globalRegionScheduler.runDelayed',
    'Bukkit.getGlobalRegionScheduler().runDelayed(plugin, task -> { ... }, delayTicks);',
    '',
    '// runTaskTimer  →  globalRegionScheduler.runAtFixedRate',
    'Bukkit.getGlobalRegionScheduler().runAtFixedRate(plugin, task -> { ... }, initDelay, period);',
    '```',
  ].join('\n'),

  ASYNC_WORLD_ACCESS: [
    '**Folia Checker** — `ASYNC_WORLD_ACCESS` _(警告)_',
    '',
    '**問題の可能性:**',
    '`Bukkit.getWorld(...)` が非同期コールバック内で呼び出されている可能性があります。',
    'Folia では非同期スレッドからのワールドアクセスはリージョンスレッド違反になります。',
    '',
    '**修正方法:**',
    '```java',
    'Bukkit.getAsyncScheduler().runNow(plugin, asyncTask -> {',
    '    // 非同期処理（DB など）',
    '    String data = fetchData();',
    '    // ワールドアクセスはリージョンスレッドで:',
    '    location.getRegionScheduler().run(plugin, regionTask -> {',
    '        world.getBlockAt(x, y, z).setType(Material.STONE);',
    '    });',
    '});',
    '```',
    '',
    '_これは警告です。呼び出しコンテキストを確認してから対応してください。_',
  ].join('\n'),
};

export class FoliaHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const foliaDiagnostic = diagnostics.find(
      (d) => d.source === 'Folia Checker' && d.range.contains(position),
    );

    if (!foliaDiagnostic) return undefined;

    const ruleId = foliaDiagnostic.code as RuleId;
    const docContent = HOVER_DOCS[ruleId];
    if (!docContent) return undefined;

    const markdownString = new vscode.MarkdownString(docContent);
    markdownString.isTrusted = true;

    return new vscode.Hover(markdownString, foliaDiagnostic.range);
  }
}
