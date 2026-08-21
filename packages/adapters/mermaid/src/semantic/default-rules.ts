/**
 * What a node probably is, read off its label. These are heuristics and they are allowed to be
 * wrong — a user rule overrides any of them — but they are what makes an unannotated flowchart come
 * out looking like an architecture drawing instead of a row of rectangles.
 *
 * Two decisions worth not reversing by accident:
 *
 * Every pattern is word-bounded. `\bdb\b` must not fire on `dbg`, and `\bapi\b` must not fire on
 * `rapid`. Substring matching looked fine on the examples and was wrong on real labels.
 *
 * A label that reads like prose abstains entirely. "Database migration guide" is a documentation
 * page, not a database, and drawing a disk next to it is worse than drawing nothing: the reader
 * trusts the icon. The guard costs a handful of false negatives on nodes genuinely called
 * "Migration service", which a user rule fixes in one line.
 */

import type { MermaidNode } from "../model/diagram.js";
import type { SemanticNodeType, SemanticRule } from "../model/semantic.js";

const PROSE = /\b(guide|guides|doc|docs|documentation|tutorial|migration|migrating|readme|how ?to|notes?|page|pages|article|chapter|overview|reference)\b/i;

/** Most specific first: "Redis" is a cache before it is a server, and "REST API" is an api before it is a service. */
const PATTERNS: readonly (readonly [RegExp, SemanticNodeType, string | undefined])[] = [
  [/\b(postgres|postgresql|mysql|mariadb|mongodb|mongo|sqlite|oracle|dynamodb|cassandra|clickhouse|database|db|datastore)\b/i, "database", "database"],
  [/\b(redis|memcached|memcache|varnish|cache|caching)\b/i, "cache", "cache"],
  [/\b(kafka|rabbitmq|rabbit|sqs|nats|queue|broker|pubsub|topic)\b/i, "queue", "queue"],
  [/\b(api|apis|graphql|rest|grpc|gateway|endpoint|openapi|swagger)\b/i, "api", "api"],
  [/\b(angular|react|vue|svelte|nextjs|next\.js|nuxt|frontend|front-end|webapp|web app|spa|browser|ui)\b/i, "frontend", "frontend"],
  [/\b(backend|back-end|django|rails|spring|laravel|express|nestjs|nest\.js|fastapi|worker)\b/i, "backend", "backend"],
  [/\b(s3|bucket|blob|minio|object storage|storage|volume|disk)\b/i, "storage", "storage"],
  [/\b(internet|www|cdn|dns)\b/i, "cloud", "internet"],
  [/\b(aws|azure|gcp|google cloud|cloud|cloudflare|kubernetes|k8s|cluster)\b/i, "cloud", "cloud"],
  [/\b(nginx|apache|server|vm|host|instance|daemon)\b/i, "server", "server"],
  [/\b(user|users|developer|developers|admin|administrator|customer|client|visitor|reader|operator)\b/i, "person", "user"],
  [/\b(service|services|microservice|micro-service|lambda|serverless)\b/i, "service", "service"],
  [/\b(component|module|library|package|sdk)\b/i, "component", "component"],
  [/\b(file|files|csv|json|yaml|xml|pdf)\b/i, "file", "file"],
  [/\b(app|application|desktop|mobile|ios|android)\b/i, "application", "application"]
];

export const defaultRules: readonly SemanticRule[] = PATTERNS.map(entry => {
  const [pattern, type, icon] = entry;
  return {
    match: (node: MermaidNode) => !PROSE.test(node.label) && pattern.test(node.label),
    type,
    icon
  };
});

/**
 * An icon name stated in the source also states the type — `service db(database)[Store]` is a
 * database whatever its label says. This is the top of the priority order, above every rule.
 */
export const ICON_TYPES: Readonly<Record<string, SemanticNodeType>> = {
  database: "database",
  disk: "storage",
  storage: "storage",
  server: "server",
  cloud: "cloud",
  internet: "cloud",
  user: "person",
  api: "api",
  queue: "queue",
  cache: "cache",
  frontend: "frontend",
  backend: "backend",
  file: "file",
  component: "component",
  application: "application",
  service: "service"
};
