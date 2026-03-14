# Folia Checker

Folia 対応 Minecraft プラグイン開発者向けの VSCode リアルタイムリンター。

`BukkitScheduler` や `BukkitRunnable` など、Folia で動作しないパターンを自動検出し、正しいスケジューラーへの移行を提案します。

---

## 機能

### リアルタイムリント
`.java` ファイルを開いた瞬間から解析が走ります。問題のある行に赤・黄色の波線が表示されます。

### ワークスペース全体のスキャン
VSCode 起動時にワークスペース内の **全 `.java` ファイル** を自動スキャン。開いていないファイルの違反も Problems パネル (`Ctrl+Shift+M`) に一覧表示されます。

既定では **Folia 依存があるプロジェクトのみ** を診断します。

### ホバードキュメント
波線にカーソルを乗せると、なぜ問題なのか・何に置き換えるべきかが詳しく表示されます。

### 手動再スキャン
`Ctrl+Shift+P` → `Folia Checker: ワークスペース全体を再スキャン`

---

## 検出ルール

| ルール | 重大度 | 検出パターン |
|---|---|---|
| `BUKKIT_SCHEDULER` | error | `Bukkit.getScheduler()`, `.getServer().getScheduler()` |
| `BUKKIT_RUNNABLE` | error | `extends BukkitRunnable`, `new BukkitRunnable(` |
| `SYNC_SCHEDULER_METHODS` | error | `runTask(`, `runTaskLater(`, `runTaskTimer(` |
| `ASYNC_WORLD_ACCESS` | warning | `Bukkit.getWorld(` |

---

## なぜ必要なのか

[Folia](https://github.com/PaperMC/Folia) は Paper の fork で、Minecraft のワールドをリージョンに分割して並列処理します。各リージョンは独立したスレッドで動作するため、従来の `BukkitScheduler` が前提としていた「グローバルなメインスレッド」が存在しません。

これにより、従来の Bukkit プラグインのスケジューラーコードはそのまま動作せず、ランタイムでクラッシュします。

### 移行例

```java
// Before（Folia でクラッシュ）
Bukkit.getScheduler().runTaskLater(plugin, () -> {
    doSomething();
}, 20L);

// After（Folia 対応）
Bukkit.getGlobalRegionScheduler().runDelayed(plugin, task -> {
    doSomething();
}, 20L);
```

### 正しいスケジューラーの選び方

| 用途 | スケジューラー |
|---|---|
| 場所に依存しないグローバルタスク | `Bukkit.getGlobalRegionScheduler()` |
| I/O・DB・ネットワーク（ワールドアクセスなし） | `Bukkit.getAsyncScheduler()` |
| エンティティに紐づくタスク | `entity.getScheduler()` |
| ワールド座標に紐づくタスク | `location.getRegionScheduler()` |

---

## 設定

| 設定 | デフォルト | 説明 |
|---|---|---|
| `foliaChecker.enable` | `true` | 診断機能の有効・無効 |
| `foliaChecker.debounceMs` | `400` | 編集後に再解析するまでの待機時間（ms） |
| `foliaChecker.includeNonFoliaProjects` | `false` | Paper/Bukkit プロジェクトも Folia 移行チェックの対象に含める |

---

## ライセンス

MIT — [IronDiscipline Project](https://github.com/IronDiscipline-Project)
