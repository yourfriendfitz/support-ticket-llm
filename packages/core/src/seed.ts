import type {
  SupportTicket,
  TicketEnvironment,
  TicketPriority,
  TicketService,
  TicketStatus
} from "./types.js";

type Scenario = {
  service: TicketService;
  title: string;
  description: string;
  tags: string[];
  assignedTeam: string;
};

const DEFAULT_SEED_COUNT = 240;
const BASE_CREATED_AT = Date.parse("2026-04-28T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

const requesters = [
  "Maya Chen",
  "Owen Patel",
  "Noah Brooks",
  "Iris Morgan",
  "Elena Torres",
  "Sam Rivera",
  "Priya Shah",
  "Theo Wright"
];

const environments: TicketEnvironment[] = ["dev", "stage", "prod", "shared"];
const statuses: TicketStatus[] = ["open", "in_progress", "blocked", "resolved", "closed"];
const priorities: TicketPriority[] = ["low", "medium", "high", "critical"];

const anchorTickets: SupportTicket[] = [
  {
    ticketId: "TCK-0001",
    title: "Lambda checkout worker times out under payment load",
    description:
      "Production checkout requests intermittently fail after the Lambda worker reaches the configured timeout. CloudWatch shows duration spikes, retry storms, and API Gateway 504 responses during peak payment traffic.",
    service: "lambda",
    environment: "prod",
    status: "open",
    priority: "critical",
    createdAt: "2026-05-05T16:45:00.000Z",
    updatedAt: "2026-05-05T17:30:00.000Z",
    requester: "Maya Chen",
    assignedTeam: "platform-runtime",
    tags: ["lambda", "timeout", "cloudwatch", "api_gateway", "payments"]
  },
  {
    ticketId: "TCK-0002",
    title: "Lambda report export hits timeout for large CSV files",
    description:
      "The scheduled export Lambda exceeds the timeout when CSV payloads include more than fifty thousand rows. The function logs repeated S3 multipart retries before failing.",
    service: "lambda",
    environment: "prod",
    status: "in_progress",
    priority: "high",
    createdAt: "2026-05-03T13:20:00.000Z",
    updatedAt: "2026-05-04T09:05:00.000Z",
    requester: "Owen Patel",
    assignedTeam: "data-platform",
    tags: ["lambda", "timeout", "s3", "export"]
  },
  {
    ticketId: "TCK-0003",
    title: "DynamoDB throttling on ticket timeline writes",
    description:
      "Ticket timeline updates are delayed because DynamoDB write capacity is throttling on the partition that stores high-volume incident comments.",
    service: "dynamodb",
    environment: "prod",
    status: "blocked",
    priority: "high",
    createdAt: "2026-05-02T21:10:00.000Z",
    updatedAt: "2026-05-03T08:45:00.000Z",
    requester: "Noah Brooks",
    assignedTeam: "data-platform",
    tags: ["dynamodb", "throttling", "capacity", "timeline"]
  },
  {
    ticketId: "TCK-0004",
    title: "IAM role missing permission for deployment pipeline",
    description:
      "The stage deployment pipeline cannot publish assets because the IAM role is missing the required S3 PutObject permission on the release bucket.",
    service: "iam",
    environment: "stage",
    status: "open",
    priority: "medium",
    createdAt: "2026-05-01T15:30:00.000Z",
    updatedAt: "2026-05-01T15:50:00.000Z",
    requester: "Iris Morgan",
    assignedTeam: "platform-security",
    tags: ["iam", "s3", "deployment", "permission"]
  },
  {
    ticketId: "TCK-0005",
    title: "EKS pods restart after memory pressure on worker nodes",
    description:
      "Several API pods on the shared EKS cluster restarted after memory pressure. The node group shows sustained container memory near the eviction threshold.",
    service: "eks",
    environment: "shared",
    status: "in_progress",
    priority: "high",
    createdAt: "2026-04-30T18:15:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    requester: "Elena Torres",
    assignedTeam: "container-platform",
    tags: ["eks", "memory", "pods", "node"]
  }
];

const scenarios: Scenario[] = [
  {
    service: "lambda",
    title: "Lambda cold start latency increases after dependency update",
    description:
      "Function initialization takes longer after a package update. Logs show cold starts exceeding the API timeout budget for sporadic user requests.",
    tags: ["lambda", "cold_start", "latency", "dependency"],
    assignedTeam: "platform-runtime"
  },
  {
    service: "eks",
    title: "EKS deployment rollout stalls during readiness checks",
    description:
      "A deployment remains partially rolled out because readiness probes fail on newly scheduled pods after configuration changes.",
    tags: ["eks", "deployment", "readiness", "pods"],
    assignedTeam: "container-platform"
  },
  {
    service: "dynamodb",
    title: "DynamoDB query latency rises for support-ticket lookups",
    description:
      "Support-ticket lookup latency increased after a new access pattern started scanning by customer identifier without a targeted index.",
    tags: ["dynamodb", "latency", "query", "index"],
    assignedTeam: "data-platform"
  },
  {
    service: "iam",
    title: "IAM policy blocks support engineer break-glass access",
    description:
      "Support engineers cannot assume the break-glass role because a permissions boundary denies the expected sts:AssumeRole action.",
    tags: ["iam", "policy", "assume_role", "access"],
    assignedTeam: "platform-security"
  },
  {
    service: "api_gateway",
    title: "API Gateway returns 429 for burst traffic",
    description:
      "Customers see throttling responses during incident updates. Usage-plan limits appear lower than the traffic profile expected by support operations.",
    tags: ["api_gateway", "throttling", "traffic", "rate_limit"],
    assignedTeam: "platform-runtime"
  },
  {
    service: "s3",
    title: "S3 attachment uploads fail for large diagnostic bundles",
    description:
      "Support-ticket attachment uploads fail for large diagnostic bundles. Browser logs show incomplete multipart upload responses.",
    tags: ["s3", "attachments", "multipart", "upload"],
    assignedTeam: "data-platform"
  },
  {
    service: "cloudwatch",
    title: "CloudWatch alarm misses Lambda error spike",
    description:
      "The configured alarm did not fire during a short Lambda error spike because the evaluation window smoothed out the failing datapoints.",
    tags: ["cloudwatch", "alarm", "lambda", "errors"],
    assignedTeam: "observability"
  },
  {
    service: "opensearch",
    title: "OpenSearch index refresh delay hides recent tickets",
    description:
      "Recent support tickets do not appear in search results until several minutes after creation. Index refresh metrics show backlog under load.",
    tags: ["opensearch", "index", "refresh", "search"],
    assignedTeam: "search-platform"
  }
];

function pick<T>(values: readonly T[], index: number): T {
  const value = values[index % values.length];
  if (value === undefined) {
    throw new Error("Cannot pick from an empty array");
  }

  return value;
}

function isoFromOffset(hoursBeforeBase: number): string {
  return new Date(BASE_CREATED_AT - hoursBeforeBase * HOUR_MS).toISOString();
}

function buildGeneratedTicket(index: number): SupportTicket {
  const scenario = pick(scenarios, index);
  const createdAt = isoFromOffset(index * 5);
  const status = pick(statuses, index + 1);

  return {
    ticketId: `TCK-${String(index + anchorTickets.length + 1).padStart(4, "0")}`,
    title: scenario.title,
    description: `${scenario.description} Case sample ${index + 1} includes environment-specific telemetry, support notes, and operational context for retrieval evaluation.`,
    service: scenario.service,
    environment: pick(environments, index + 2),
    status,
    priority: pick(priorities, index + 3),
    createdAt,
    updatedAt:
      status === "resolved" || status === "closed"
        ? isoFromOffset(index * 5 - 3)
        : isoFromOffset(index * 5 - 1),
    requester: pick(requesters, index + 4),
    assignedTeam: scenario.assignedTeam,
    tags: [...scenario.tags, pick(["customer", "incident", "runbook", "automation"], index)]
  };
}

export function createSeedTickets(count = DEFAULT_SEED_COUNT): SupportTicket[] {
  const targetCount = Math.max(count, anchorTickets.length);
  const generatedCount = targetCount - anchorTickets.length;
  const generatedTickets = Array.from({ length: generatedCount }, (_, index) =>
    buildGeneratedTicket(index)
  );

  return [...anchorTickets, ...generatedTickets];
}
