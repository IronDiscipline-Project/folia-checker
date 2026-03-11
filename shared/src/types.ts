export type RuleId =
  | 'BUKKIT_SCHEDULER'
  | 'BUKKIT_RUNNABLE'
  | 'SYNC_SCHEDULER_METHODS'
  | 'ASYNC_WORLD_ACCESS'
  | 'LEGACY_ASYNC_SCHEDULER'
  | 'CANCEL_TASK'
  | 'UNSAFE_CHUNK_ACCESS';

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
}
