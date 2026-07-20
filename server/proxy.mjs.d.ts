export function installProxyHandlers(appOrServer: unknown, maybeServer?: unknown): void;
export function mediaRetrievalEnabled(): boolean;
export function proxyHeaders(originalHeaders: Record<string, unknown>, token: string, target: URL, correlation: { requestId: string; editorCorrelationId: string }): Record<string, unknown>;
export function responseHeaders(upstreamHeaders: Record<string, unknown>, setCookie: string | undefined, correlation: { requestId: string; editorCorrelationId: string }): Record<string, unknown>;
export function parseProjectEditorBootstrapRoute(pathname: string): { targetPath: string; methods: string[] } | null;
export function parseMediaLibraryRoute(pathname: string): { targetPath: string; methods: string[] } | null;
export function parseAlbumPickerRoute(pathname: string): { targetPath: string; methods: string[] } | null;
export function parseTimelineRenderJobRoute(pathname: string): { targetPath: string; methods: string[] } | null;
export function trustedVideoMediaScope(projectMediaResponse: unknown): {
  mediaIds: string[];
  scopeRevision: string | undefined;
};
export function buildTrustedVideoRetrievalRequest(browserBody: unknown, projectMediaResponse: unknown): {
  projectId: string;
  mediaIds: string[];
  scopeRevision?: string;
  query: string;
  modalities: string[];
  topK: number;
  expandGraph: boolean;
};
