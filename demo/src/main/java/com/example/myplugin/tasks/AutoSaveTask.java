package com.example.myplugin.tasks;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;
import com.example.myplugin.MyPlugin;

/**
 * 定期的にデータを保存するタスク
 * ❌ BukkitRunnable を使っているため Folia 非互換
 */
public class AutoSaveTask extends BukkitRunnable {

    private final MyPlugin plugin;

    public AutoSaveTask(MyPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public void run() {
        plugin.getLogger().info("オートセーブ中...");

        // ❌ ASYNC_WORLD_ACCESS: BukkitRunnable の run() はスレッドが不定
        var world = Bukkit.getWorld("world");
        if (world != null) {
            world.save();
        }

        // ❌ BUKKIT_SCHEDULER: タスク内でさらにスケジューラーを使用
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            plugin.getLogger().info("オートセーブ完了");
        }, 5L);
    }
}
