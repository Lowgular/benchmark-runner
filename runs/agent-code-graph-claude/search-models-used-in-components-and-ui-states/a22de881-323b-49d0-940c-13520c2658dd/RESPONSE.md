Based on my comprehensive analysis of the codebase using the code graph, I found that:

**No matches found.**

After extensive querying, I was unable to find model declarations (as ClassDeclaration nodes) that are explicitly used by both Angular components and UI states. 

Here's what I discovered:

1. **Angular Components found:** ButtonComponent, MemberComponent, TeamsPageComponent, AppComponent, AuditLogComponent
2. **UI State classes found:** AnalyticsState, TeamCacheUiState, TeamListUiState, TeamSubjectUiState
3. **Shared references:** While components and UI states DO reference common identifiers (like "Team", "TeamFilterModel", "TeamActionModel"), these appear to be TypeScript interfaces or type aliases rather than ClassDeclaration nodes tracked by the code graph

The code graph primarily tracks ClassDeclaration nodes, which means:
- Type aliases (e.g., `type Team = {...}`)
- Interfaces (e.g., `interface Team {...}`)
- Generic types not directly declared as classes

...are not visible in this analysis.

If you're looking for specific model patterns or want to refine the search criteria (e.g., looking for specific service classes or data transfer objects), please let me know and I can adjust the search accordingly.
