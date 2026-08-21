import { describe, expect, it } from "vitest";
import type { MermaidDiagram, MermaidNode } from "../model/diagram.js";
import type { SemanticNodeType, SemanticOptions } from "../model/semantic.js";
import { enrichMermaid } from "./enrich.js";

const node = (label: string, extra: Partial<MermaidNode> = {}): MermaidNode => ({
  id: label.toLowerCase().replace(/\W/g, ""),
  label,
  shape: "rectangle",
  classNames: [],
  ...extra
});

const diagram = (nodes: readonly MermaidNode[]): MermaidDiagram => ({
  type: "flowchart",
  direction: "LR",
  nodes,
  edges: [],
  groups: [],
  alignments: []
});

const typeOf = (label: string, options?: SemanticOptions): SemanticNodeType => {
  const first = enrichMermaid(diagram([node(label)]), options).nodes.at(0);
  if (first === undefined) throw new Error("no node");
  return first.type;
};

describe("enrichMermaid", () => {
  it("recognises the databases", () => {
    for (const label of ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "Postgres", "Users DB", "MariaDB"]) {
      expect(typeOf(label), label).toBe("database");
    }
  });

  it("recognises the caches, before reading them as servers", () => {
    for (const label of ["Redis", "Memcached", "Varnish", "Session cache"]) {
      expect(typeOf(label), label).toBe("cache");
    }
  });

  it("recognises the queues", () => {
    for (const label of ["Kafka", "RabbitMQ", "SQS", "Job queue", "Event broker"]) {
      expect(typeOf(label), label).toBe("queue");
    }
  });

  it("recognises the APIs", () => {
    for (const label of ["REST API", "GraphQL", "gRPC service", "API Gateway"]) {
      expect(typeOf(label), label).toBe("api");
    }
  });

  it("recognises the front ends", () => {
    for (const label of ["Angular", "React", "Vue", "Web app", "Browser"]) {
      expect(typeOf(label), label).toBe("frontend");
    }
  });

  it("recognises the people", () => {
    for (const label of ["User", "Developer", "Admin", "Customer"]) {
      expect(typeOf(label), label).toBe("person");
    }
  });

  /*
   * The decision this pins: a label that reads like prose abstains. "Database migration guide" is a
   * documentation page, and drawing a disk beside it is worse than drawing nothing, because a reader
   * trusts the icon more than they re-read the label. The cost is a false negative on a node genuinely
   * called "Migration service", which one user rule fixes.
   */
  it("abstains on a label that reads like prose", () => {
    expect(typeOf("Database migration guide")).toBe("unknown");
    expect(typeOf("How to configure Redis")).toBe("unknown");
    expect(typeOf("API reference")).toBe("unknown");
  });

  it("matches on word boundaries, not substrings", () => {
    // `\bapi\b` must not fire on "rapid", and `\bdb\b` must not fire on "dbus".
    expect(typeOf("Rapid prototype")).toBe("unknown");
    expect(typeOf("Something dbus")).toBe("unknown");
  });

  it("leaves an unrecognised node unknown, and still renders it", () => {
    const enriched = enrichMermaid(diagram([node("Widget factory")]));
    expect(enriched.nodes).toHaveLength(1);
    expect(enriched.nodes.at(0)).toMatchObject({ type: "unknown", label: "Widget factory" });
  });

  it("gives a matched node the rule's icon", () => {
    const enriched = enrichMermaid(diagram([node("PostgreSQL")]));
    expect(enriched.nodes.at(0)?.icon).toBe("database");
  });

  // The priority order the whole stage exists to express.
  it("lets a user rule beat a default one", () => {
    const options: SemanticOptions = { rules: [{ match: candidate => candidate.label === "Redis", type: "storage", icon: "storage" }] };
    expect(typeOf("Redis", options)).toBe("storage");
    expect(typeOf("Memcached", options)).toBe("cache");
  });

  it("drops every default when asked", () => {
    expect(typeOf("PostgreSQL", { disableDefaults: true })).toBe("unknown");
    expect(typeOf("PostgreSQL", { disableDefaults: true, rules: [{ match: () => true, type: "service" }] })).toBe("service");
  });

  it("lets an icon stated in the source beat every rule", () => {
    // `service store(database)[Anything]` is a database whatever its label says, and a user rule
    // matching on the label must not override what the author wrote explicitly.
    const stated = diagram([node("Anything", { icon: "database", shape: "service" })]);
    const enriched = enrichMermaid(stated, { rules: [{ match: () => true, type: "queue", icon: "queue" }] });
    expect(enriched.nodes.at(0)).toMatchObject({ type: "database", icon: "database" });
  });

  it("falls back to service for an icon it has no type mapping for", () => {
    const enriched = enrichMermaid(diagram([node("Payments", { icon: "credit-card" })]));
    expect(enriched.nodes.at(0)).toMatchObject({ type: "service", icon: "credit-card" });
  });

  it("leaves a junction alone, since it has no label to read", () => {
    const enriched = enrichMermaid(diagram([{ id: "j", label: "", shape: "junction", classNames: [] }]), {
      rules: [{ match: () => true, type: "database", icon: "database" }]
    });
    expect(enriched.nodes.at(0)).toMatchObject({ type: "unknown" });
    expect(enriched.nodes.at(0)?.icon).toBeUndefined();
  });

  it("passes edges, groups and alignments through untouched", () => {
    const source: MermaidDiagram = {
      ...diagram([node("A")]),
      edges: [{ source: "a", target: "a", type: "solid", sourceArrow: "none", targetArrow: "arrow" }],
      groups: [{ id: "g", label: "G", children: ["a"] }],
      alignments: [{ kind: "row", ids: ["a"] }]
    };
    const enriched = enrichMermaid(source);
    expect(enriched.edges).toBe(source.edges);
    expect(enriched.groups).toBe(source.groups);
    expect(enriched.alignments).toBe(source.alignments);
  });
});
