import { createFileRoute } from "@tanstack/react-router";

// Server-to-server endpoint for the n8n pipeline. Callers must send
// `Authorization: Bearer <PIPELINE_API_TOKEN>`; nothing here is browser-facing.
async function handle(request: Request, op: string) {
  const { checkPipelineAuth } = await import("@/lib/pipeline-auth.server");
  const denied = checkPipelineAuth(request.headers.get("authorization"), process.env["PIPELINE_API_TOKEN"]);
  if (denied) return denied;
  const { handlePipelineRequest } = await import("@/lib/pipeline.server");
  return handlePipelineRequest(op, request);
}

export const Route = createFileRoute("/api/public/pipeline/$op")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params.op),
      POST: ({ request, params }) => handle(request, params.op),
    },
  },
});
