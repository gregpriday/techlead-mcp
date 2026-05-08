export type EvalIssueResult = {
  id: string;
  planRan: boolean;
  reviewRan: boolean;
  verdict?: string;
  error?: string;
};

export type EvalReport = {
  issueCount: number;
  planRuns: number;
  reviewRuns: number;
  approved: number;
  needsChanges: number;
  blocked: number;
  insufficientContext: number;
  errors: number;
  results: EvalIssueResult[];
};

export function summarizeEval(results: EvalIssueResult[]): EvalReport {
  return {
    issueCount: results.length,
    planRuns: results.filter(result => result.planRan).length,
    reviewRuns: results.filter(result => result.reviewRan).length,
    approved: results.filter(result => result.verdict === "approved").length,
    needsChanges: results.filter(result => result.verdict === "needs_changes").length,
    blocked: results.filter(result => result.verdict === "blocked").length,
    insufficientContext: results.filter(result => result.verdict === "insufficient_context").length,
    errors: results.filter(result => result.error).length,
    results
  };
}
