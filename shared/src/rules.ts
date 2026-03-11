import type { FoliaRule } from './types';

export const FOLIA_RULES: FoliaRule[] = [
  {
    id: 'BUKKIT_SCHEDULER',
    severity: 'error',
    patternSource: String.raw`Bukkit\.getScheduler\(\)|\.getServer\(\)\.getScheduler\(\)`,
    message: (m) =>
      `'${m}' は BukkitScheduler へのアクセスで Folia 非互換です。` +
      `Folia はリージョンスレッドモデルを採用しており、グローバルなメインスレッドは存在しません。`,
    fixSuggestion:
      'Folia スケジューラーに置き換えてください:\n' +
      '  • Bukkit.getGlobalRegionScheduler()  — 場所に依存しないグローバルタスク\n' +
      '  • Bukkit.getAsyncScheduler()          — I/O・DB・ネットワーク（ワールドアクセス禁止）\n' +
      '  • entity.getScheduler()               — エンティティに紐づくタスク\n' +
      '  • location.getRegionScheduler()       — ワールド座標に紐づくタスク',
  },

  {
    id: 'BUKKIT_RUNNABLE',
    severity: 'error',
    patternSource: String.raw`\bextends\s+BukkitRunnable\b|\bnew\s+BukkitRunnable\s*\(`,
    message: (_m) =>
      `'BukkitRunnable' は Folia 非互換です。` +
      `BukkitRunnable は BukkitScheduler のメソッドに依存しており、Folia では削除されています。`,
    fixSuggestion:
      'ラムダを Folia スケジューラーに渡す形に書き換えてください:\n' +
      '  • Bukkit.getGlobalRegionScheduler().run(plugin, task -> { ... })\n' +
      '  • Bukkit.getGlobalRegionScheduler().runDelayed(plugin, task -> { ... }, delayTicks)\n' +
      '  • Bukkit.getGlobalRegionScheduler().runAtFixedRate(plugin, task -> { ... }, initDelay, period)\n' +
      '  • Bukkit.getAsyncScheduler().runNow(plugin, task -> { ... })',
  },

  {
    id: 'SYNC_SCHEDULER_METHODS',
    severity: 'error',
    // runTaskAsynchronously / runTaskTimerAsynchronously は Folia でも存在するため除外
    patternSource: String.raw`\b(runTask|runTaskLater|runTaskTimer)\s*\(`,
    message: (m) =>
      `'${m.trim()}' は Bukkit の同期スケジューラーメソッドで、Folia では削除されています。` +
      `グローバルなメインスレッドが存在しないためです。`,
    fixSuggestion:
      'リージョン対応スケジューラーを使用してください:\n' +
      '  • エンティティ: entity.getScheduler().run(plugin, task -> { ... }, null)\n' +
      '  • 座標: location.getRegionScheduler().run(plugin, task -> { ... })\n' +
      '  • グローバル: Bukkit.getGlobalRegionScheduler().run(plugin, task -> { ... })',
  },

  {
    id: 'ASYNC_WORLD_ACCESS',
    severity: 'warning',
    patternSource: String.raw`\bBukkit\.getWorld\s*\(`,
    message: (_m) =>
      `'Bukkit.getWorld(...)' を検出しました。非同期コールバック内から呼び出している場合、` +
      `Folia ではリージョンスレッド違反になります。`,
    fixSuggestion:
      'ワールドへのアクセスは正しいリージョンスレッドで行ってください:\n' +
      '  • runTaskAsynchronously 内にある場合は location.getRegionScheduler().run(...) で\n' +
      '    リージョンスレッドに戻ってからアクセスしてください',
  },
];
