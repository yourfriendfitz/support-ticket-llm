export const TICKET_SERVICES = [
  "lambda",
  "eks",
  "dynamodb",
  "iam",
  "api_gateway",
  "s3",
  "cloudwatch",
  "opensearch"
] as const;

export const TICKET_ENVIRONMENTS = ["dev", "stage", "prod", "shared"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "blocked", "resolved"] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TICKET_SORTS = ["relevance", "createdAt_desc"] as const;

export type TicketService = (typeof TICKET_SERVICES)[number];
export type TicketEnvironment = (typeof TICKET_ENVIRONMENTS)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketSort = (typeof TICKET_SORTS)[number];

export type SupportTicket = {
  id: string;
  title: string;
  description: string;
  service: TicketService;
  environment: TicketEnvironment;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  requester: string;
  assignedTeam: string;
  tags: string[];
  resolutionSummary?: string;
};

export type TicketEmbeddingRecord = {
  ticketId: string;
  embedding: number[];
  sourceTextHash: string;
};

export type TicketSearchFilters = {
  services?: TicketService[];
  environments?: TicketEnvironment[];
  statuses?: TicketStatus[];
  priorities?: TicketPriority[];
  assignedTeams?: string[];
  createdAfter?: string;
  createdBefore?: string;
};

export type TicketSearchRequest = {
  query: string;
  filters?: TicketSearchFilters;
  limit?: number;
  sort?: TicketSort;
};

export type TicketSearchResult = {
  ticket: SupportTicket;
  score: number;
  lexicalScore: number;
  vectorScore: number;
  matchReasons: string[];
};

export type TicketSearchResponse = {
  query: string;
  filters: TicketSearchFilters;
  limit: number;
  sort: TicketSort;
  results: TicketSearchResult[];
  diagnostics: {
    totalTickets: number;
    filteredTickets: number;
    returnedTickets: number;
    strategy: "hybrid_lexical_vector";
  };
};
