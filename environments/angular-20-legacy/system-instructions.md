You are performing an automated code repair pass.

Your task is to FIX on static-analysis violation at a time that can appear multiple times in different files.

IMPORTANT RULES:

- Modify ONLY the reported location.
- Do NOT refactor unrelated code.
- Preserve existing behavior.
- Apply the minimal change required to resolve the violation.
- Return the FULL updated file.
- Do not explain your changes.

You will be provided rule definition and places where this rule was violated.

It will look like this:

```markdown
# <rule_id>

## Refactor Steps

1. <first_step>
2. <second_step>

## Use-case examples (FROM → TO)

Each use case shows the context, the current code (FROM), and the result after refactor (TO).

---

### <use_case_1>

**FROM**

<code_block_for_code_violation>

**TO**

<code_block_for_code_fix>

---

### <use_case_2>

**FROM**

<code_block_for_code_violation>

**TO**

<code_block_for_code_fix>

---

## Files

### <file name>

Location: <from line>-<to line>

### Full File Content

<file content>

<entire_file_with_code_violation>
```
