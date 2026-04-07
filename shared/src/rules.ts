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
    quickFix: [
      { pattern: String.raw`Bukkit\.getScheduler\(\)`, replacement: 'Bukkit.getGlobalRegionScheduler()' },
      { pattern: String.raw`\.getServer\(\)\.getScheduler\(\)`, replacement: '.getServer().getGlobalRegionScheduler()' },
    ],
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
    quickFix: [
      { pattern: String.raw`new\s+BukkitRunnable\s*\(`, replacement: '/* TODO: Folia移行 — ラムダ + Folia Scheduler に書き換え */ new BukkitRunnable(' },
    ],
  },

  {
    id: 'SYNC_SCHEDULER_METHODS',
    severity: 'error',
    // runTaskAsynchronously / runTaskTimerAsynchronously は Folia でも存在するため除外
    // \. を要求してオブジェクトのメソッド呼び出しに限定（汎用メソッド名の誤検知を防ぐ）
    patternSource: String.raw`\.(runTask|runTaskLater|runTaskTimer)\s*\(`,
    message: (m) =>
      `'${m.trim()}' は Bukkit の同期スケジューラーメソッドで、Folia では削除されています。` +
      `グローバルなメインスレッドが存在しないためです。`,
    fixSuggestion:
      'リージョン対応スケジューラーを使用してください:\n' +
      '  • エンティティ: entity.getScheduler().run(plugin, task -> { ... }, null)\n' +
      '  • 座標: location.getRegionScheduler().run(plugin, task -> { ... })\n' +
      '  • グローバル: Bukkit.getGlobalRegionScheduler().run(plugin, task -> { ... })',
    quickFix: [
      { pattern: String.raw`\.runTask\s*\(`, replacement: '.run(' },
      { pattern: String.raw`\.runTaskLater\s*\(`, replacement: '.runDelayed(' },
      { pattern: String.raw`\.runTaskTimer\s*\(`, replacement: '.runAtFixedRate(' },
    ],
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
    // \. を要求して BukkitScheduler のメソッド呼び出しに限定
    patternSource: String.raw`\.(scheduleAsyncDelayedTask|scheduleAsyncRepeatingTask)\s*\(`,
    message: (m) =>
      `'${m.trim()}' は Bukkit の旧非同期スケジューラー API で、Folia では削除されています。`,
    fixSuggestion:
      'Bukkit.getAsyncScheduler() に移行してください:\n' +
      '  • scheduleAsyncDelayedTask    →  Bukkit.getAsyncScheduler().runDelayed(plugin, task -> { ... }, delay, TimeUnit.MILLISECONDS)\n' +
      '  • scheduleAsyncRepeatingTask  →  Bukkit.getAsyncScheduler().runAtFixedRate(plugin, task -> { ... }, initDelay, period, TimeUnit.MILLISECONDS)',
    quickFix: [
      { pattern: String.raw`\.scheduleAsyncDelayedTask\s*\(`, replacement: '.runDelayed(' },
      { pattern: String.raw`\.scheduleAsyncRepeatingTask\s*\(`, replacement: '.runAtFixedRate(' },
    ],
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
    // \. を要求して World/Chunk のメソッド呼び出しに限定（汎用名の誤検知を防ぐ）
    patternSource: String.raw`\.(getChunkAt|loadChunk)\s*\(`,
    message: (m) =>
      `'${m.trim()}' はリージョンスレッド外から呼び出すと Folia でクラッシュする可能性があります。`,
    fixSuggestion:
      'チャンク操作は対象座標のリージョンスレッドで行ってください:\n' +
      '  location.getRegionScheduler().run(plugin, task -> {\n' +
      '      Chunk chunk = location.getChunk(); // リージョンスレッド内で安全\n' +
      '  });',
  },

  // ─── New Rules ───────────────────────────────────────────────────────────────

  {
    id: 'TELEPORT_SYNC',
    severity: 'error',
    patternSource: String.raw`\.teleport\s*\(`,
    message: (_m) =>
      `同期テレポート '.teleport()' は Folia では非推奨です。` +
      `エンティティが別リージョンに移動する場合、同期テレポートはスレッド違反を引き起こします。`,
    fixSuggestion:
      '非同期テレポートに置き換えてください:\n' +
      '  • entity.teleportAsync(location)  — CompletableFuture<Boolean> を返す\n' +
      '  • entity.teleportAsync(location).thenAccept(success -> { ... })',
    quickFix: [
      { pattern: String.raw`\.teleport\s*\(`, replacement: '.teleportAsync(' },
    ],
  },

  {
    id: 'GET_ONLINE_PLAYERS',
    severity: 'warning',
    patternSource: String.raw`\bBukkit\.getOnlinePlayers\s*\(\)|\.getServer\(\)\.getOnlinePlayers\s*\(\)`,
    message: (_m) =>
      `'getOnlinePlayers()' の結果をイテレートしてエンティティ操作を行うと、` +
      `Folia ではリージョンスレッド違反になる可能性があります。` +
      `各プレイヤーが異なるリージョンスレッドに属する場合があるためです。`,
    fixSuggestion:
      '各プレイヤーの操作はそのプレイヤーのスケジューラーで行ってください:\n' +
      '  for (Player p : Bukkit.getOnlinePlayers()) {\n' +
      '      p.getScheduler().run(plugin, task -> {\n' +
      '          // p に対する操作（安全）\n' +
      '      }, null);\n' +
      '  }',
  },

  {
    id: 'CANCEL_ALL_TASKS',
    severity: 'error',
    patternSource: String.raw`\.cancelTasks\s*\(`,
    message: (_m) =>
      `'.cancelTasks(plugin)' は BukkitScheduler のメソッドで Folia では使用できません。` +
      `Folia では各 ScheduledTask を個別にキャンセルする必要があります。`,
    fixSuggestion:
      'スケジューラーが返す ScheduledTask をコレクションで管理してキャンセルしてください:\n' +
      '  List<ScheduledTask> tasks = new ArrayList<>();\n' +
      '  tasks.add(Bukkit.getGlobalRegionScheduler().runAtFixedRate(...));\n' +
      '  // プラグイン無効化時:\n' +
      '  tasks.forEach(ScheduledTask::cancel);',
  },
];
