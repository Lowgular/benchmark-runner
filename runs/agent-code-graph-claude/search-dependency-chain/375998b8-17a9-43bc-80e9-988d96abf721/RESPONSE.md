Excellent! I found dependency chains between 3-5 hops in your codebase. Here are the results:

## Found 2 dependency chains (3 hops each):

**Chain 1:**
- TeamsService - TeamEntity
- TeamEntity - MemberEntity

**Chain 2:**
- TeamsController - TeamEntity
- TeamEntity - MemberEntity

These chains represent dependencies within your TypeScript/Angular codebase, where:
- `TeamsService` and `TeamsController` depend on `TeamEntity` 
- `TeamEntity` depends on `MemberEntity` (through property type declarations)

All dependencies are from the web folder and exclude node_modules as requested.
