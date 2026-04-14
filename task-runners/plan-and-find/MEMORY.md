# Eval System Memory

## Purpose

This repository contains an evaluation system for comparing two agents:

- `bash`
- `code-graph`

The goal is to benchmark retrieval and reasoning quality under a fair setup.

## Fairness Principle

Both agents should follow the same high-level workflow and reasoning stages.
Differences should be limited to execution backend and query language, not prompt
advantages.

Shared workflow shape:

1. Normalize user request to AST-semantic intent.
2. Translate intent to executable form.
3. Execute with bounded retry.
4. Post-process and return grounded results.

## Stage Differences

- `bash` agent:
  - Executes via shell-oriented pipeline (for example candidate narrowing + AST
    extraction).
- `code-graph` agent:
  - Executes via Cypher query against code-graph backend.

The reasoning stages are intentionally aligned; execution mechanism is the
planned divergence.

## Tooling Overview (High Level)

The system uses helper tools to separate concerns:

- `list_pattern_catalog`: exposes available pattern vocabulary.
- `search_pattern_context`: retrieves base pattern semantics and related context.
- `search_constraint_context`: resolves extra constraint concepts.
- `search_cypher_context`: retrieves Cypher composition guidance.
- `code-graph-query`: executes final Cypher query.

These tools support composable intent construction (base pattern + constraints)
before execution.

## Entry Point

The main orchestration entry point is `agents/src/main.ts`.

This file wires model, agent prompt, tools, backend, and middleware for runs.
For implementation details, read `main.ts` and the tool files under
`agents/src/tools/`.
