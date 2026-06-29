import { EditorWorkspace } from "./editor-workspace";

interface EditorMockWorkspaceProps {
  projectId: string;
}

export function EditorMockWorkspace({ projectId }: EditorMockWorkspaceProps) {
  return <EditorWorkspace projectId={projectId} />;
}
