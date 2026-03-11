package com.example.myplugin.managers;

import org.bukkit.Bukkit;
import org.bukkit.Chunk;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

/**
 * ❌ 旧 API・チャンク操作・タスクキャンセルの問題を示すデモ
 * このファイルには複数の Folia 非互換パターンが含まれています
 */
public class WorldManager {

    private final Plugin plugin;
    private BukkitTask autoSaveTask;
    private int cleanupTaskId;

    public WorldManager(Plugin plugin) {
        this.plugin = plugin;
    }

    /**
     * ❌ LEGACY_ASYNC_SCHEDULER: 旧非同期スケジューラー API
     */
    public void startLegacyAsyncTasks() {
        // scheduleAsyncDelayedTask は Folia で削除済み
        Bukkit.getScheduler().scheduleAsyncDelayedTask(plugin, () -> {
            plugin.getLogger().info("旧 API による非同期遅延タスク");
        }, 100L);

        // scheduleAsyncRepeatingTask も削除済み
        Bukkit.getScheduler().scheduleAsyncRepeatingTask(plugin, () -> {
            plugin.getLogger().info("旧 API による非同期リピートタスク");
        }, 0L, 200L);
    }

    /**
     * ❌ CANCEL_TASK: int ID によるタスクキャンセル
     */
    public void startAndCancelTask() {
        // タスクを開始して ID を保持
        cleanupTaskId = Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            plugin.getLogger().info("クリーンアップタスク実行");
        }, 0L, 600L).getTaskId();

        // 5秒後にキャンセル — cancelTask(int) は Folia で使えない
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            Bukkit.getScheduler().cancelTask(cleanupTaskId);
        }, 100L);
    }

    /**
     * ❌ UNSAFE_CHUNK_ACCESS: リージョンスレッド外でのチャンク操作
     */
    public void loadChunksAsync(World world) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            // 非同期スレッドからのチャンク操作 — Folia でクラッシュ
            Chunk chunk = world.getChunkAt(0, 0);
            world.loadChunk(10, 10, true);
        });
    }

    /**
     * ❌ 複合問題: 非同期 + ワールドアクセス + チャンク操作
     */
    public void doEverythingWrong(Location location) {
        Bukkit.getScheduler().scheduleAsyncDelayedTask(plugin, () -> {
            // 非同期スレッドからのワールドアクセス
            World world = Bukkit.getWorld("world");
            if (world == null) return;

            // 非同期スレッドからのチャンク操作
            Chunk chunk = world.getChunkAt(location);
            world.loadChunk(chunk);

            chunk.getBlock(0, 64, 0).setType(Material.DIAMOND_BLOCK);
        }, 20L);
    }

    /**
     * ✅ 正しい実装: リージョンスケジューラーでチャンク操作
     */
    public void loadChunkSafely(Location location) {
        location.getRegionScheduler().run(plugin, task -> {
            Chunk chunk = location.getChunk(); // リージョンスレッド内で安全
            chunk.getBlock(0, 64, 0).setType(Material.DIAMOND_BLOCK);
        });
    }

    /**
     * ✅ 正しい実装: ScheduledTask オブジェクトでキャンセル
     */
    public void startCancellableTask() {
        var task = Bukkit.getGlobalRegionScheduler().runAtFixedRate(plugin, t -> {
            plugin.getLogger().info("Folia 対応タスク");
        }, 1L, 600L);

        Bukkit.getAsyncScheduler().runDelayed(plugin, t -> {
            task.cancel(); // ScheduledTask.cancel() で安全にキャンセル
        }, 5L, java.util.concurrent.TimeUnit.SECONDS);
    }
}
