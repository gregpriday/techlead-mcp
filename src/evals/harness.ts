import type { TechLeadConfig } from "../config/defaults.js";
import { createDefaultProviders, type ProviderRegistry } from "../providers/index.js";
import { plan } from "../core/plan.js";
import { review } from "../core/review.js";
import { evalFixtureSchema, type EvalFixture } from "./fixtures.js";
import { summarizeEval, type EvalReport, type EvalIssueResult } from "./metrics.js";

export type EvalHarnessOptions = {
  config: TechLeadConfig;
  providers?: ProviderRegistry;
};

export async function runEvalHarness(input: unknown, options: EvalHarnessOptions): Promise<EvalReport> {
  const fixture: EvalFixture = evalFixtureSchema.parse(input);
  const providers = options.providers ?? createDefaultProviders();
  const results: EvalIssueResult[] = [];

  for (const issue of fixture.issues) {
    try {
      let planRan = false;
      let reviewRan = false;
      let verdict: string | undefined;
      if (issue.planInput) {
        await plan(issue.planInput, { config: options.config, providers, allowLocalFiles: true });
        planRan = true;
      }
      if (issue.reviewInput) {
        const reviewOutput = await review(issue.reviewInput, {
          config: options.config,
          providers,
          allowLocalFiles: true
        });
        reviewRan = true;
        verdict = reviewOutput.verdict;
      }
      results.push({ id: issue.id, planRan, reviewRan, verdict });
    } catch (error) {
      results.push({
        id: issue.id,
        planRan: false,
        reviewRan: false,
        error: (error as Error).message
      });
    }
  }

  return summarizeEval(results);
}
