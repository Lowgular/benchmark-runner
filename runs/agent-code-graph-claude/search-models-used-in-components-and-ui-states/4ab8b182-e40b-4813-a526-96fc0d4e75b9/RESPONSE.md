Let me run separate queries and combine the results. I already have the results from my previous queries, so let me compile them:

Based on my analysis of the codebase, I found models that are used by both Angular components and UI states (either Injectable services or classes with State/Store in their names).

From my executed queries:
1. Models used by **components + Injectable services**: Team, AuditLog
2. Models used by **components + State/Store classes**: Team, TeamActionModel, TeamFilterModel

**Complete list of models used by both components and UI states:**

Found 4 match(es).

- AuditLog — web/src/app/teams/audit-log.ts
- Team — web/src/app/teams/team.ts
- TeamActionModel — web/src/app/teams/team-action.model.ts
- TeamFilterModel — web/src/app/teams/team-filter.model.ts
