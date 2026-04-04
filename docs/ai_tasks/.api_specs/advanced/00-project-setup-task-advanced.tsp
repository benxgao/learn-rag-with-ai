import "@typespec/http";
import "@typespec/rest";

using TypeSpec.Http;
using TypeSpec.Rest;

/** AI RAG API Specification - Task 00: Project Setup
 *
 * System Health & Configuration Validation
 * Verify all components (OpenAI, Pinecone, Firebase) are connected
 */
@service({
  title: "AI RAG API - Task 00: Project Setup",
  version: "1.0.0",
})
@server(
  "http://localhost:3000",
  "Development server"
)
@server(
  "https://api.example.com",
  "Production server"
)
namespace AIRagAPI.ProjectSetup;

// ============================================================================
// TASK 00: Project Setup - System Health & Configuration Validation
// ============================================================================

/** Health check endpoint for system readiness validation
 *
 * Task: 00 - Project Setup
 * Purpose: Verify all components (OpenAI, Pinecone, Firebase) are connected
 * Use case: Environment validation, CI/CD health checks
 */
@doc("Verify system readiness and component connectivity")
@route("/api/health")
op getHealth(): HealthStatus;

model HealthStatus {
  @doc("Overall system status: healthy | degraded | error")
  status: "healthy" | "degraded" | "error";

  @doc("Timestamp in ISO 8601 format")
  timestamp: utcDateTime;

  @doc("Individual component status checks")
  components: {
    @doc("OpenAI API connection and model availability")
    openai: ComponentStatus;

    @doc("Pinecone vector database connection")
    pinecone: ComponentStatus;

    @doc("Firebase authentication and RTDB")
    firebase: ComponentStatus;
  };

  @doc("Current vector count in Pinecone index")
  vectorCount: int32;

  @doc("Index metadata including dimension and metric")
  indexMetadata?: {
    dimension: int32;
    metric: "cosine" | "euclidean" | "dotproduct";
    replicas: int32;
  };
}

model ComponentStatus {
  @doc("Component availability: up | down")
  status: "up" | "down";

  @doc("Additional component-specific details")
  details?: string;

  @doc("Last verified timestamp")
  lastChecked: utcDateTime;
}
