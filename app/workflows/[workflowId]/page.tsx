import { WorkflowsClient } from "../workflows-client";

export default async function WorkflowDetailPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  return <WorkflowsClient workflowId={workflowId} />;
}
