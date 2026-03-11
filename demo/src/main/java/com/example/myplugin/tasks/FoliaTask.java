package com.example.myplugin.tasks;

import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

/**
 * ✅ Folia 対応の正しい実装例
 * このファイルには波線が表示されません
 */
public class FoliaTask {

    private final Plugin plugin;

    public FoliaTask(Plugin plugin) {
        this.plugin = plugin;
    }

    /**
     * ✅ グローバルな定期タスク（場所に依存しない処理）
     */
    public void startGlobalTimer() {
        Bukkit.getGlobalRegionScheduler().runAtFixedRate(plugin, task -> {
            plugin.getLogger().info("グローバルタイマー実行中");
        }, 1L, 200L);
    }

    /**
     * ✅ プレイヤーへの遅延メッセージ（エンティティスケジューラー）
     */
    public void sendDelayedMessage(Player player, String message, long delayTicks) {
        player.getScheduler().runDelayed(plugin, task -> {
            player.sendMessage(message);
        }, null, delayTicks);
    }

    /**
     * ✅ 特定座標でのブロック変更（リージョンスケジューラー）
     */
    public void setBlockDelayed(org.bukkit.Location location, Material material, long delayTicks) {
        location.getRegionScheduler().runDelayed(plugin, task -> {
            location.getBlock().setType(material);
        }, delayTicks);
    }

    /**
     * ✅ DB 保存などの純粋な非同期処理（ワールドアクセスなし）
     */
    public void saveDataAsync(String data) {
        Bukkit.getAsyncScheduler().runNow(plugin, task -> {
            // ワールドにアクセスしない純粋な I/O 処理
            writeToDatabase(data);
        });
    }

    /**
     * ✅ 非同期で取得 → リージョンスレッドでワールド操作
     */
    public void fetchAndApply(Player player) {
        Bukkit.getAsyncScheduler().runNow(plugin, asyncTask -> {
            // 非同期でデータ取得（DB, HTTP など）
            String result = fetchFromDatabase(player.getUniqueId().toString());

            // ワールド操作はリージョンスレッドに戻してから
            player.getScheduler().run(plugin, regionTask -> {
                player.sendMessage("§aデータ取得完了: " + result);
                player.getInventory().addItem(
                    new org.bukkit.inventory.ItemStack(Material.DIAMOND)
                );
            }, null);
        });
    }

    private void writeToDatabase(String data) { /* 省略 */ }
    private String fetchFromDatabase(String uuid) { return "sample"; }
}
