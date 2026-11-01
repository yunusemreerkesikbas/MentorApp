import { defineConfig } from "orval";

/**
 * Codegen: apps/api OpenAPI spec → typed client (§8).
 * Regenerate: `pnpm --filter @mentor/api openapi:export && pnpm --filter @mentor/api-client generate`.
 */
export default defineConfig({
  mentor: {
    input: "./openapi.json",
    output: {
      target: "./src/generated/api.ts",
      client: "fetch",
      override: {
        operations: {
          PlanPreviewController_offer: { fetch: { includeHttpResponseReturnType: false } },
          PlanPreviewController_brief: { fetch: { includeHttpResponseReturnType: false } },
          PlanPreviewController_create: { fetch: { includeHttpResponseReturnType: false } },
          PlanPreviewController_read: { fetch: { includeHttpResponseReturnType: false } },
          PlanPreviewController_confirm: { fetch: { includeHttpResponseReturnType: false } },
          EconomyController_questsList: {
            fetch: { includeHttpResponseReturnType: false },
          },
          EconomyController_weeklyChestView: {
            fetch: { includeHttpResponseReturnType: false },
          },
          EconomyController_weeklyChestOpen: {
            fetch: { includeHttpResponseReturnType: false },
          },
          EconomyController_deepAnalysisState: {
            fetch: { includeHttpResponseReturnType: false },
          },
          EconomyController_deepAnalysisPurchase: {
            fetch: { includeHttpResponseReturnType: false },
          },
          EconomyUsesController_get: {
            fetch: { includeHttpResponseReturnType: false },
          },
          NotebookSlotsController_state: {
            fetch: { includeHttpResponseReturnType: false },
          },
          NotebookSlotsController_purchase: {
            fetch: { includeHttpResponseReturnType: false },
          },
          MentorshipCoachController_listPlanningTasks: {
            fetch: { includeHttpResponseReturnType: false },
          },
        },
        mutator: { path: "./src/http.ts", name: "http" },
        // Our mutator returns the parsed body. Scope this to the new contract so
        // existing generated callers keep their current public types.
        tags: {
          "weekly-recaps": { fetch: { includeHttpResponseReturnType: false } },
          phone: { fetch: { includeHttpResponseReturnType: false } },
          "mentorship-followups": {
            fetch: { includeHttpResponseReturnType: false },
          },
          "mentorship-weekly-reports": {
            fetch: { includeHttpResponseReturnType: false },
          },
        },
      },
    },
  },
});
