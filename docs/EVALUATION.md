# Evaluation design

**Question:** do static validation, acceptance testing and self-repair improve the reliability of AI-generated MVPs?

## Conditions
| Id | Pipeline | Purpose |
|---|---|---|
| `baseline` | requirements -> plan -> code -> build | control |
| `proposed` | ... -> static validation -> build -> smoke -> acceptance -> targeted repair (max 3) | treatment |
| `blind_retry` | baseline, but on build failure regenerates **without error feedback**, same attempt budget | ablation |

Why the third condition: `proposed` gets extra LLM calls. Without `blind_retry`, a gain could simply be "more tries". `blind_retry` isolates whether *feedback from validation* is what helps. Run it if budget allows; the two required conditions work without it.
Held constant across conditions: planner output format, models, temperature, prompts for requirements/planning/coding, template, benchmark items. The planner's checks are given to the coding agent in all conditions.

## Avoiding circular scoring
The planner writes acceptance checks, and the repair loop optimizes against them. Scoring on those same checks would measure self-consistency, not quality. So there are two suites:
- **planner checks** (`suite: planner`): run inside the pipeline; drive repair; shown in the dashboard demo ("Checks passed 11/12").
- **held-out checks** (`suite: heldout`): hand-written per benchmark item *before* any run, never shown to any agent, run only by the harness after the pipeline ends, in every condition. **All reported feature-completion numbers use these.**

## Benchmark
20-30 items (`benchmark/benchmark.json`, schema `BenchmarkItemSchema`), spread across the 10 supported types, each with `requirement_text`, `expected_features` (ground truth for extraction accuracy) and 4-10 held-out checks. Freeze it before the first experiment run. Run **3 trials per item per condition** at fixed temperature, because LLM output varies run to run (e.g. 25 items x 3 trials x 2 conditions = 150 generations; this number and the cost are estimates to confirm with a pilot of ~5 items).

## Metrics (all recorded in `MetricsRecord`)
| Metric | Definition |
|---|---|
| Initial build success | first generated code builds, before any repair (also measured in baseline) |
| Final build success | builds at the end of the run |
| Repair success rate | runs that needed repair and ended building / runs that needed repair |
| Avg repair attempts | mean attempts among runs that needed repair |
| Feature completion rate | held-out checks passed / held-out checks total |
| Planner-check pass rate | planner checks passed / total (reported separately, labeled as in-loop) |
| Requirement extraction F1 | extracted features vs `expected_features` (matched by an LLM judge + manual spot check) |
| Requirement-plan consistency | features with >=1 planner check / features |
| Generation time, tokens, LLM calls | per stage and total |
| Failure rate | outcome `failed` / runs, with `failure_stage` and `failure_code` |
| Human-rated quality | 2 raters, 1-5 on functionality, UI quality, requirement fit, overall; blind to condition; report inter-rater agreement |

## Analysis plan
Paired by (item, trial). Build success: McNemar's test (or exact binomial on discordant pairs). Continuous metrics (completion rate, time, ratings): Wilcoxon signed-rank with bootstrap 95% CIs. Report effect sizes, not only p-values. State threats to validity: LLM nondeterminism, a benchmark of simple apps, held-out checks written by the same authors, rater subjectivity, a single provider/model pair.

## Reproducibility
Record provider, model names, temperature, template version, schema version and git commit in every run. `RUN_MODE=replay` re-executes build/tests deterministically from recorded LLM outputs, so experiments can be re-scored without new API spend.
