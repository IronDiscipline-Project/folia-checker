import type { AnalysisResult, MigrationReport } from './types';

/**
 * Generate a migration readiness report from analysis results.
 */
export function generateMigrationReport(results: AnalysisResult[]): MigrationReport {
  const totalFiles = results.length;
  const analyzedFiles = results.filter((r) => !r.error).length;

  let totalViolations = 0;
  let errorCount = 0;
  let warningCount = 0;
  const violationsByRule: Record<string, number> = {};
  let filesWithViolations = 0;

  for (const result of results) {
    if (result.violations.length > 0) {
      filesWithViolations++;
    }
    for (const v of result.violations) {
      totalViolations++;
      if (v.severity === 'error') errorCount++;
      else warningCount++;
      violationsByRule[v.ruleId] = (violationsByRule[v.ruleId] ?? 0) + 1;
    }
  }

  const cleanFiles = analyzedFiles - filesWithViolations;

  // Score: 100 when no violations, penalised by errors (×3) and warnings (×1)
  const maxPenalty = analyzedFiles > 0 ? analyzedFiles * 10 : 1;
  const penalty = Math.min(errorCount * 3 + warningCount, maxPenalty);
  const readinessScore = analyzedFiles > 0
    ? Math.max(0, Math.round((1 - penalty / maxPenalty) * 100))
    : 100;

  return {
    totalFiles,
    analyzedFiles,
    cleanFiles,
    filesWithViolations,
    totalViolations,
    errorCount,
    warningCount,
    violationsByRule,
    readinessScore,
  };
}

/**
 * Format a migration report as a human-readable string.
 */
export function formatMigrationReport(report: MigrationReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════');
  lines.push('  Folia Migration Report');
  lines.push('═══════════════════════════════════════════════════');
  lines.push('');

  // Readiness gauge
  const gauge = renderGauge(report.readinessScore);
  lines.push(`  移行準備スコア: ${gauge} ${report.readinessScore}%`);
  lines.push('');

  // Summary
  lines.push('── 概要 ──────────────────────────────────────────');
  lines.push(`  解析ファイル数:     ${report.analyzedFiles} / ${report.totalFiles}`);
  lines.push(`  問題のあるファイル: ${report.filesWithViolations}`);
  lines.push(`  問題なしファイル:   ${report.cleanFiles}`);
  lines.push(`  違反総数:           ${report.totalViolations} (エラー: ${report.errorCount}, 警告: ${report.warningCount})`);
  lines.push('');

  // Breakdown by rule
  if (Object.keys(report.violationsByRule).length > 0) {
    lines.push('── ルール別内訳 ──────────────────────────────────');
    const sorted = Object.entries(report.violationsByRule).sort((a, b) => b[1] - a[1]);
    for (const [ruleId, count] of sorted) {
      const bar = '█'.repeat(Math.min(count, 30));
      lines.push(`  ${ruleId.padEnd(25)} ${String(count).padStart(4)}  ${bar}`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('── 推奨アクション ────────────────────────────────');
  if (report.errorCount === 0 && report.warningCount === 0) {
    lines.push('  ✓ Folia 互換性の問題は見つかりませんでした。移行準備完了です！');
  } else {
    if (report.violationsByRule['BUKKIT_SCHEDULER'] || report.violationsByRule['BUKKIT_RUNNABLE']) {
      lines.push('  1. スケジューラーの移行を最優先で行ってください');
      lines.push('     BukkitScheduler → GlobalRegionScheduler / AsyncScheduler');
    }
    if (report.violationsByRule['TELEPORT_SYNC']) {
      lines.push('  2. teleport() → teleportAsync() に置き換えてください');
    }
    if (report.violationsByRule['SYNC_SCHEDULER_METHODS'] || report.violationsByRule['LEGACY_ASYNC_SCHEDULER']) {
      lines.push('  3. 旧スケジューラーメソッドを Folia 対応メソッドに移行してください');
    }
    if (report.warningCount > 0) {
      lines.push(`  ※ 警告 ${report.warningCount} 件はコンテキストに依存します。手動で確認してください。`);
    }
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════');

  return lines.join('\n');
}

function renderGauge(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}
