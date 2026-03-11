package com.example.myplugin.managers;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * クールダウン管理マネージャー
 * ❌ 非同期処理と同期スケジューラーが混在している
 */
public class CooldownManager {

    private final Plugin plugin;
    private final Map<UUID, Long> cooldowns = new ConcurrentHashMap<>();

    public CooldownManager(Plugin plugin) {
        this.plugin = plugin;

        // ❌ BUKKIT_SCHEDULER + SYNC_SCHEDULER_METHODS: 定期クリーンアップ
        Bukkit.getScheduler().runTaskTimer(plugin, () -> {
            long now = System.currentTimeMillis();
            cooldowns.entrySet().removeIf(e -> now > e.getValue());
        }, 0L, 1200L);
    }

    public boolean isOnCooldown(Player player) {
        return cooldowns.containsKey(player.getUniqueId())
            && System.currentTimeMillis() < cooldowns.get(player.getUniqueId());
    }

    public void setCooldown(Player player, int seconds) {
        cooldowns.put(player.getUniqueId(),
            System.currentTimeMillis() + (seconds * 1000L));

        // ❌ BUKKIT_RUNNABLE: クールダウン終了通知
        new BukkitRunnable() {
            @Override
            public void run() {
                if (player.isOnline()) {
                    player.sendMessage("§aクールダウンが終了しました！");
                }
            }
        }.runTaskLater(plugin, seconds * 20L);
    }

    public void clearPlayer(UUID uuid) {
        cooldowns.remove(uuid);
    }

    public void saveAll() {
        // ❌ BUKKIT_SCHEDULER: 保存処理を非同期で実行
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            // DB に保存...
            plugin.getLogger().info("クールダウンデータを保存しました (" + cooldowns.size() + " 件)");

            // ❌ ASYNC_WORLD_ACCESS: 非同期内でワールド情報を取得（危険）
            var world = Bukkit.getWorld("world");
            if (world != null) {
                plugin.getLogger().info("ワールド時刻: " + world.getTime());
            }
        });
    }
}
