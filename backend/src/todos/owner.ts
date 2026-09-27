import type { FastifyRequest } from 'fastify';

/**
 * The single place that decides whose todos a request acts on (FR-019).
 * v1 has no accounts, so every request belongs to the implicit owner "local".
 * When authentication is added, read the owner from the session here; nothing else changes.
 */
export function getOwnerId(_request: FastifyRequest): string {
  return 'local';
}
