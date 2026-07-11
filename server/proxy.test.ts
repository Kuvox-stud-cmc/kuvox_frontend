import { describe, expect, it } from "vitest";

import { parseTimelineRenderJobRoute } from "./proxy.mjs";

describe("render job BFF routes", () => {
  it("proxies authenticated render status reads", () => {
    expect(parseTimelineRenderJobRoute("/bff/timelines/render-jobs/job-1")).toEqual({
      targetPath: "/api/timelines/render-jobs/job-1",
      methods: ["GET"],
    });
  });

  it("proxies render output GET and HEAD requests", () => {
    expect(parseTimelineRenderJobRoute("/bff/timelines/render-jobs/job-1/output")).toEqual({
      targetPath: "/api/timelines/render-jobs/job-1/output",
      methods: ["GET", "HEAD"],
    });
  });
});
