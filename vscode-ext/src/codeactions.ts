import * as vscode from 'vscode';
import { FOLIA_RULES } from '@foliachecker/shared';
import type { RuleId } from '@foliachecker/shared';

/**
 * Provides Quick Fix code actions for Folia Checker diagnostics.
 * When a violation has a quickFix definition, this provider offers
 * an automatic replacement via the light-bulb menu.
 */
export class FoliaCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'Folia Checker') continue;

      const ruleId = diagnostic.code as RuleId;
      const rule = FOLIA_RULES.find((r) => r.id === ruleId);
      if (!rule?.quickFix) continue;

      const lineText = document.lineAt(diagnostic.range.start.line).text;
      const matchedPortion = lineText.substring(
        diagnostic.range.start.character,
        diagnostic.range.end.character,
      );

      for (const fix of rule.quickFix) {
        const fixPattern = new RegExp(fix.pattern);
        if (!fixPattern.test(matchedPortion)) continue;

        const replaced = matchedPortion.replace(fixPattern, fix.replacement);

        const action = new vscode.CodeAction(
          `Folia 互換に修正: ${replaced.trim()}`,
          vscode.CodeActionKind.QuickFix,
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, diagnostic.range, replaced);
        action.edit = edit;

        actions.push(action);
        break; // one fix per diagnostic
      }
    }

    return actions;
  }
}
