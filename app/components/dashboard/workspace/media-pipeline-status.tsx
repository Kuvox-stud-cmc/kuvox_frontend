import { StatusBadge } from "~/components/dashboard/layout/DashboardPageLayout";
import type { MediaDto } from "~/lib/api";
import {
  mediaPipelineTone,
  resolveMediaPipeline,
  type MediaPipeline,
} from "~/lib/media-pipeline";

export function MediaPipelineStatus({
  media,
  pipeline,
  compact = false,
  showDetail = true,
}: {
  media: MediaDto;
  pipeline?: MediaPipeline | null;
  compact?: boolean;
  showDetail?: boolean;
}) {
  const state = resolveMediaPipeline(media, pipeline);
  const tone = mediaPipelineTone(state.stage);
  const progress = Math.min(100, Math.max(0, (state.step / state.stepCount) * 100));

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <StatusBadge label={state.label} tone={tone} pulse={!state.terminal} />
        {!state.terminal && (
          <span className="text-label-sm text-on-surface-variant">
            {state.step}/{state.stepCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <StatusBadge label={state.label} tone={tone} pulse={!state.terminal} />
        {!state.terminal && (
          <span className="text-label-sm text-on-surface-variant">
            Step {state.step}/{state.stepCount}
          </span>
        )}
      </div>
      {!state.terminal && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {showDetail && (
        <p
          className={`text-label-md ${
            state.stage === "failed" ? "text-error/70" : "text-on-surface-variant"
          }`}
        >
          {state.detail}
        </p>
      )}
    </div>
  );
}
