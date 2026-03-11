package com.example.myplugin;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import com.example.myplugin.managers.CooldownManager;
import com.example.myplugin.tasks.AutoSaveTask;
import com.example.myplugin.tasks.CleanupTask;
import com.example.myplugin.listeners.PlayerJoinListener;
import com.example.myplugin.commands.TeleportCommand;

/**
 * メインプラグインクラス
 * 複数の Folia 非互換パターンが含まれています
 */
public class MyPlugin extends JavaPlugin {

    private CooldownManager cooldownManager;

    @Override
    public void onEnable() {
        this.cooldownManager = new CooldownManager(this);

        // ❌ BUKKIT_SCHEDULER: BukkitScheduler を取得している
        var scheduler = Bukkit.getScheduler();

        // ❌ BUKKIT_RUNNABLE + SYNC_SCHEDULER_METHODS: 起動時タスク
        new AutoSaveTask(this).runTaskTimer(this, 0L, 6000L);

        // ❌ SYNC_SCHEDULER_METHODS: 遅延タスク
        Bukkit.getScheduler().runTaskLater(this, () -> {
            getLogger().info("プラグインの初期化が完了しました");
            loadWorldData();
        }, 20L);

        // ❌ BUKKIT_SCHEDULER: サーバー経由のスケジューラー取得
        getServer().getScheduler().runTask(this, () -> {
            Bukkit.broadcastMessage("§a[MyPlugin] サーバーに接続しました！");
        });

        // ✅ 正しい Folia のやり方（波線なし）
        Bukkit.getAsyncScheduler().runNow(this, task -> {
            getLogger().info("設定ファイルを非同期で読み込み中...");
        });

        getServer().getPluginManager().registerEvents(new PlayerJoinListener(this), this);
        getCommand("tp").setExecutor(new TeleportCommand(this));
    }

    @Override
    public void onDisable() {
        // ❌ SYNC_SCHEDULER_METHODS: 終了時のクリーンアップタスク
        Bukkit.getScheduler().runTask(this, () -> {
            new CleanupTask().run();
        });

        cooldownManager.saveAll();
    }

    private void loadWorldData() {
        // ❌ ASYNC_WORLD_ACCESS: メインスレッド以外から呼ばれる可能性
        var world = Bukkit.getWorld("world");
        if (world != null) {
            getLogger().info("ワールドサイズ: " + world.getLoadedChunks().length + " chunks");
        }
    }

    public CooldownManager getCooldownManager() {
        return cooldownManager;
    }
}
