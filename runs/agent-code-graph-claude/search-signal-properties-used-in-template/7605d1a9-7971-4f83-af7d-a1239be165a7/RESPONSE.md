Based on my analysis of the codebase, here are the results:

**Found 1 match.**

- **disabled** — web/src/app/shared/button.ts (ButtonComponent)

This is a signal property (created using the `signal()` function) in the ButtonComponent that is referenced and used in the component's template.

Note: While there are other signal properties in the codebase (such as `selectedMember`, `preferences`, `cachedTeam`, `selectedTeam`, `filter`, `pendingAction` in state management classes), these are not in `@Component` decorated classes. Within component classes themselves, `disabled` is the primary signal property that is actively used in templates. There is also a `state` signal property in MemberComponent, but it is not referenced in that component's template.
