export type RuleId =
  | 'BUKKIT_SCHEDULER'
  | 'BUKKIT_RUNNABLE'
  | 'SYNC_SCHEDULER_METHODS'
  | 'ASYNC_WORLD_ACCESS'
  | 'LEGACY_ASYNC_SCHEDULER'
  | 'CANCEL_TASK'
  | 'UNSAFE_CHUNK_ACCESS'
  | 'TELEPORT_SYNC'
  | 'GET_ONLINE_PLAYERS'
  | 'CANCEL_ALL_TASKS';

export type Severity = 'error' | 'warning';

/**
 * A single Folia compatibility violation found in a Java file.
 */
export interface Violation {
  ruleId: RuleId;
  severity: Severity;
  /** 1-based line number */
  line: number;
  /** 0-based column of the first character of the match */
  column: number;
  /** 0-based column of the character AFTER the last character of the match */
  endColumn: number;
  message: string;
  fixSuggestion: string;
  matchedText: string;
}

export interface AnalysisResult {
  filePath: string;
  violations: Violation[];
  /** Populated if the file could not be read */
  error?: string;
}

export interface FoliaRule {
  id: RuleId;
  severity: Severity;
  /**
   * Pattern source string (not a RegExp object).
   * The analyzer creates fresh RegExp instances per line to avoid lastIndex bugs.
   */
  patternSource: string;
  message: (matchedText: string) => string;
  fixSuggestion: string;
  /**
   * Optional quick-fix replacement map.
   * Keys are regex pattern strings, values are the replacement strings.
   * Used by the Code Action provider to offer automatic fixes.
   */
  quickFix?: { pattern: string; replacement: string }[];
}

/**
 * Summary statistics for a migration report.
 */
export interface MigrationReport {
  totalFiles: number;
  analyzedFiles: number;
  cleanFiles: number;
  filesWithViolations: number;
  totalViolations: number;
  errorCount: number;
  warningCount: number;
  violationsByRule: Record<string, number>;
  /** 0–100 score representing migration readiness */
  readinessScore: number;
}
