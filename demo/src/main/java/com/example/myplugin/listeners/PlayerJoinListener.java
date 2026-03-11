package com.example.myplugin.listeners;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitRunnable;
import com.example.myplugin.MyPlugin;

/**
 * プレイヤーの入退室を管理するリスナー
 * ❌ 複数の Folia 非互換パターンを含む
 */
public class PlayerJoinListener implements Listener {

    private final MyPlugin plugin;

    public PlayerJoinListener(MyPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();

        // ❌ BUKKIT_RUNNABLE: 匿名クラスでウェルカムメッセージを遅延表示
        new BukkitRunnable() {
            @Override
            public void run() {
                if (player.isOnline()) {
                    player.sendMessage("§aようこそ！ " + player.getName() + " さん！");
                    player.sendMessage("§7現在のプレイヤー数: " + Bukkit.getOnlinePlayers().size());
                }
            }
        }.runTaskLater(plugin, 40L);

        // ❌ SYNC_SCHEDULER_METHODS: 統計の非同期更新
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            // データベースに接続時刻を記録
            saveLoginTime(player.getUniqueId().toString());

            // ❌ ASYNC_WORLD_ACCESS: 非同期内でワールドにアクセス（危険！）
            var world = Bukkit.getWorld("world");
            if (world != null) {
                // スポーン地点の情報をログに記録（スレッド安全でない）
                var spawn = world.getSpawnLocation();
                plugin.getLogger().info(player.getName() + " がスポーン: " + spawn);
            }
        });

        // ❌ BUKKIT_SCHEDULER + SYNC_SCHEDULER_METHODS: 入場エフェクト
        Bukkit.getScheduler().runTask(plugin, () -> {
            player.getWorld().strikeLightningEffect(player.getLocation());
        });
    }

    @EventHandler
    public void onPlayerQuit(PlayerQuitEvent event) {
        // ❌ BUKKIT_RUNNABLE: 退出後のクリーンアップ
        new BukkitRunnable() {
            @Override
            public void run() {
                plugin.getCooldownManager().clearPlayer(event.getPlayer().getUniqueId());
            }
        }.runTask(plugin);
    }

    private void saveLoginTime(String uuid) {
        // DB 保存処理（省略）
    }
}
