import * as fs from 'fs';
import * as path from 'path';
import { FOLIA_RULES } from './rules';
import type { Violation, AnalysisResult } from './types';

// ─── Comment Stripping ────────────────────────────────────────────────────────

/**
 * Strip a single-line comment suffix from a line.
 * Handles the case where // appears inside a string literal.
 */
function stripLineComment(line: string): string {
  let inString = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\' && inString) {
      i += 2;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === '/' && line[i + 1] === '/') {
      return line.slice(0, i);
    }
    i++;
  }
  return line;
}

// ─── Content Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze Java source code provided as a string.
 * Synchronous — safe to call from VS Code extension host main thread.
 */
export function analyzeContent(content: string, filePath: string): AnalysisResult {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  let inBlockComment = false;

  lines.forEach((rawLine, lineIndex) => {
    let lineForAnalysis = rawLine;

    if (inBlockComment) {
      const closeIndex = rawLine.indexOf('*/');
      if (closeIndex === -1) {
        return; // Entire line is a block comment
      }
      inBlockComment = false;
      lineForAnalysis = rawLine.slice(closeIndex + 2);
    }

    const openIndex = lineForAnalysis.indexOf('/*');
    if (openIndex !== -1) {
      lineForAnalysis = lineForAnalysis.slice(0, openIndex);
      inBlockComment = true;
    }

    lineForAnalysis = stripLineComment(lineForAnalysis);

    for (const rule of FOLIA_RULES) {
      const pattern = new RegExp(rule.patternSource, 'g');
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(lineForAnalysis)) !== null) {
        violations.push({
          ruleId: rule.id,
          severity: rule.severity,
          line: lineIndex + 1,
          column: match.index,
          endColumn: match.index + match[0].length,
          message: rule.message(match[0]),
          fixSuggestion: rule.fixSuggestion,
          matchedText: match[0],
        });
      }
    }
  });

  return { filePath, violations };
}

// ─── File-level Analysis ──────────────────────────────────────────────────────

export function analyzeFile(filePath: string): AnalysisResult {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      filePath,
      violations: [],
      error: `Cannot read file: ${(err as NodeJS.ErrnoException).message}`,
    };
  }
  return analyzeContent(content, filePath);
}

// ─── Project-level Analysis ───────────────────────────────────────────────────

function collectJavaFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJavaFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Analyze all Java files under src/main/java in a Maven project.
 */
export function analyzeProject(projectPath: string): AnalysisResult[] {
  const javaRoot = path.join(projectPath, 'src', 'main', 'java');

  if (!fs.existsSync(javaRoot)) {
    return [
      {
        filePath: javaRoot,
        violations: [],
        error: `Maven Java ソースルートが見つかりません: ${javaRoot}`,
      },
    ];
  }

  const javaFiles = collectJavaFiles(javaRoot);

  if (javaFiles.length === 0) {
    return [
      {
        filePath: javaRoot,
        violations: [],
        error: `${javaRoot} に .java ファイルが見つかりません`,
      },
    ];
  }

  return javaFiles.map((f) => analyzeFile(f));
}
