package com.example.myplugin.commands;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;
import com.example.myplugin.MyPlugin;

/**
 * テレポートコマンド (/tp)
 * ❌ エンティティ操作を間違ったスケジューラーで行っている
 */
public class TeleportCommand implements CommandExecutor {

    private final MyPlugin plugin;

    public TeleportCommand(MyPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) return false;
        if (args.length < 1) {
            player.sendMessage("使い方: /tp <プレイヤー名>");
            return true;
        }

        Player target = Bukkit.getPlayer(args[0]);
        if (target == null) {
            player.sendMessage("§cプレイヤーが見つかりません: " + args[0]);
            return true;
        }

        player.sendMessage("§eテレポートします...");

        // ❌ BUKKIT_RUNNABLE: カウントダウン後にテレポート
        new BukkitRunnable() {
            int count = 3;

            @Override
            public void run() {
                if (!player.isOnline()) {
                    cancel();
                    return;
                }
                if (count > 0) {
                    player.sendMessage("§e" + count + "...");
                    count--;
                } else {
                    // ❌ SYNC_SCHEDULER_METHODS: テレポート実行
                    Bukkit.getScheduler().runTask(plugin, () -> {
                        player.teleport(target.getLocation());
                        player.sendMessage("§aテレポートしました！");
                    });
                    cancel();
                }
            }
        }.runTaskTimer(plugin, 0L, 20L);

        // ✅ 正しい Folia のやり方（波線なし）
        // player.getScheduler().runDelayed(plugin, task -> {
        //     player.teleport(target.getLocation());
        // }, null, 60L);

        return true;
    }
}
