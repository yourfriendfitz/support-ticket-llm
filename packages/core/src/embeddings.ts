import type { SupportTicket, TicketEmbeddingRecord } from "./types.js";

export const EMBEDDING_DIMENSIONS = 24;

const TOKEN_PATTERN = /[a-z0-9]+/g;

export function tokenize(value: string): string[] {
  return (value.toLowerCase().match(TOKEN_PATTERN) ?? []).map((token) =>
    token.endsWith("s") && token.length > 3 ? token.slice(0, -1) : token
  );
}

export function hashText(value: string): string {
  return hashToken(value).toString(16).padStart(8, "0");
}

export function hashToken(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createTicketEmbeddingText(ticket: SupportTicket): string {
  return [
    ticket.title,
    ticket.description,
    ticket.service.replace("_", " "),
    ticket.environment,
    ticket.status,
    ticket.priority,
    ticket.assignedTeam,
    ticket.tags.join(" ")
  ].join(" ");
}

export function embedText(value: string): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);

  for (const token of tokenize(value)) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIMENSIONS;
    const sign = (hash >>> 8) % 2 === 0 ? 1 : -1;
    const weight = 1 + Math.min(token.length, 12) / 12;
    vector[index] = (vector[index] ?? 0) + sign * weight;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, valueAtIndex) => sum + valueAtIndex ** 2, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((valueAtIndex) => Number((valueAtIndex / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const dimensions = Math.min(left.length, right.length);
  let dotProduct = 0;

  for (let index = 0; index < dimensions; index += 1) {
    dotProduct += (left[index] ?? 0) * (right[index] ?? 0);
  }

  return dotProduct;
}

export function createTicketEmbedding(ticket: SupportTicket): TicketEmbeddingRecord {
  const sourceText = createTicketEmbeddingText(ticket);

  return {
    ticketId: ticket.id,
    embedding: embedText(sourceText),
    sourceTextHash: hashText(sourceText)
  };
}

export function createTicketEmbeddings(tickets: readonly SupportTicket[]): TicketEmbeddingRecord[] {
  return tickets.map(createTicketEmbedding);
}
