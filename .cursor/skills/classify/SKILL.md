---
name: classify
description: Classifies a selected TypeScript snippet into a code-graph pattern id using class/decorator tags. Use when the user asks to classify selection, map code to a pattern, identify angular.component vs angular.service, or provides file path with optional line range.
---

# Classify Snippet To Pattern

## 1. Map root pattern

Read and execute the reference: `./references/map-pattern.md`

Now you should have a root pattern classified

## 2. Read knowledge about this pattern's variant

Each root pattern can have multiple variants. Fetch them by pattern id using: `./references/map-variant.md`

Use this knowledge to classify which variant fits best for the provided context in section 2.

## Response:

If none of the variants match the knowledge provided, then you should just respond with the decription of root pattern and mention which variants were considered.

If multiple variants are matching the knowledge provided, then you should respond with all the variants descriptions and explain why are they a good match.

If there is a dominam variant matching the knowledge provided, then you should respond only with this variant description.

Favor the single variant at all costs, use the other two options only if in doubt.
