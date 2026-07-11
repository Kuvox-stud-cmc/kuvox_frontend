import type { VideoTrackingBox, VideoTrackingTarget } from "./video-document";

export type VideoAnalysisTask = "detect-subjects" | "track-region" | "auto-reframe";

export interface VideoAnalysisStartMessage {
  type: "start";
  requestId: string;
  task: VideoAnalysisTask;
  mediaUrl: string;
  sourceIn: number;
  sourceOut: number;
  frameRate: number;
  initialRegion?: VideoTrackingBox;
  targetAspectRatio?: string;
}

export interface VideoAnalysisCancelMessage {
  type: "cancel";
  requestId: string;
}

export type VideoAnalysisWorkerRequest = VideoAnalysisStartMessage | VideoAnalysisCancelMessage;

export interface VideoAnalysisProgressMessage {
  type: "progress";
  requestId: string;
  progress: number;
  analyzedFrames: number;
  totalFrames: number;
}

export interface VideoAnalysisResultMessage {
  type: "result";
  requestId: string;
  targets: VideoTrackingTarget[];
}

export interface VideoAnalysisErrorMessage {
  type: "error";
  requestId: string;
  code: "cancelled" | "unsupported" | "model-load-failed" | "analysis-failed";
  message: string;
}

export type VideoAnalysisWorkerResponse =
  | VideoAnalysisProgressMessage
  | VideoAnalysisResultMessage
  | VideoAnalysisErrorMessage;
