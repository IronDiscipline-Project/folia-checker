import * as fs from 'fs';
import * as path from 'path';
import { FOLIA_RULES } from './rules';
import type { Violation, AnalysisResult } from './types';

// ─── Project Detection ────────────────────────────────────────────────────────

/** ファイルから親ディレクトリを辿り、Bukkit 系プロジェクトのビルドファイルを探す */
function findProjectBuildFile(startPath: string): string | null {
  let dir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  for (let i = 0; i < 10; i++) {
    for (const name of ['pom.xml', 'build.gradle', 'build.gradle.kts']) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * 指定パス配下のプロジェクトが Bukkit 系（Bukkit / Paper / Folia）プラグインかどうかを判定する。
 *
 * pom.xml または build.gradle* に Bukkit 系の依存が含まれている場合に `true` を返す。
 * ビルドファイルが見つからない場合は `true`（フォールバック: ファイル単体での判定に委ねる）。
 */
export function isBukkitProject(startPath: string): boolean {
  const buildFile = findProjectBuildFile(startPath);
  if (!buildFile) return true; // ビルドファイルなし → 判定不能なのでスキャンを許可

  let content: string;
  try {
    content = fs.readFileSync(buildFile, 'utf-8');
  } catch {
    return true;
  }

  // Bukkit / Spigot / Paper / Folia の代表的な groupId・artifactId・パッケージ名
  return /org\.bukkit|io\.papermc|dev\.folia|spigotmc|net\.md-5/i.test(content);
}

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
  // org.bukkit / io.papermc の import がないファイルは Bukkit 系ではないためスキップ
  if (!/^\s*import\s+(org\.bukkit|io\.papermc)\b/m.test(content)) {
    return { filePath, violations: [] };
  }

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
      const closeOnSameLine = lineForAnalysis.indexOf('*/', openIndex + 2);
      if (closeOnSameLine !== -1) {
        // /* ... */ が同一行で完結 — コメント部分だけ除去して残りを解析
        lineForAnalysis = lineForAnalysis.slice(0, openIndex) + lineForAnalysis.slice(closeOnSameLine + 2);
      } else {
        lineForAnalysis = lineForAnalysis.slice(0, openIndex);
        inBlockComment = true;
      }
    }

    lineForAnalysis = stripLineComment(lineForAnalysis);

    // import / package 宣言はランタイム違反を含まないためスキップ
    if (/^\s*(import|package)\s/.test(lineForAnalysis)) return;

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
