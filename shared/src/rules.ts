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

  {
    id: 'LEGACY_ASYNC_SCHEDULER',
    severity: 'error',
    patternSource: String.raw`\b(scheduleAsyncDelayedTask|scheduleAsyncRepeatingTask)\s*\(`,
    message: (m) =>
      `'${m.trim()}' は Bukkit の旧非同期スケジューラー API で、Folia では削除されています。`,
    fixSuggestion:
      'Bukkit.getAsyncScheduler() に移行してください:\n' +
      '  • scheduleAsyncDelayedTask    →  Bukkit.getAsyncScheduler().runDelayed(plugin, task -> { ... }, delay, TimeUnit.MILLISECONDS)\n' +
      '  • scheduleAsyncRepeatingTask  →  Bukkit.getAsyncScheduler().runAtFixedRate(plugin, task -> { ... }, initDelay, period, TimeUnit.MILLISECONDS)',
  },

  {
    id: 'CANCEL_TASK',
    severity: 'error',
    patternSource: String.raw`\.cancelTask\s*\(`,
    message: (_m) =>
      `'.cancelTask(id)' は BukkitScheduler のメソッドで Folia では使用できません。` +
      `Folia では ScheduledTask オブジェクトを通じてキャンセルします。`,
    fixSuggestion:
      'スケジューラーが返す ScheduledTask を保持してキャンセルしてください:\n' +
      '  ScheduledTask task = Bukkit.getGlobalRegionScheduler().runDelayed(...);\n' +
      '  task.cancel(); // int ID ではなくオブジェクトで管理',
  },

  {
    id: 'UNSAFE_CHUNK_ACCESS',
    severity: 'warning',
    patternSource: String.raw`\b(getChunkAt|loadChunk)\s*\(`,
    message: (m) =>
      `'${m.trim()}' はリージョンスレッド外から呼び出すと Folia でクラッシュする可能性があります。`,
    fixSuggestion:
      'チャンク操作は対象座標のリージョンスレッドで行ってください:\n' +
      '  location.getRegionScheduler().run(plugin, task -> {\n' +
      '      Chunk chunk = location.getChunk(); // リージョンスレッド内で安全\n' +
      '  });',
  },
];
