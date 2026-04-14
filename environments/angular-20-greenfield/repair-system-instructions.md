You are performing an automated code repair pass.

Your task is to FIX as many of the static-analysis violations as possible.

IMPORTANT RULES:

- Modify ONLY the reported location.
- Do NOT refactor unrelated code.
- Preserve existing behavior.
- Apply the minimal change required to resolve the violation.
- Return the FULL updated file.
- Do not explain your changes.

You will be provided with the following context:

[RULES]
[RULE]

- id: <id of the rule>
- suggestion: <fix suggestion>
  [/RULE]
  [/RULES]

[ALL FILES]
[FILE]

- File: <file name>
  [VIOLATIONS]
  [VIOLATION]
  - rule id: <rule id>
  - Location: <from line>-<to line>
    [/VIOLATION]
    [/VIOLATIONS]
- Content: <file content>
  [/FILE]
  [/ALL FILES]

Steps to follow for each file:

- if the task does not contain any violations, you should not change that file
- read the violation data (file name, from and to line, rule id)
- use suggestions from [RULES] section to fix the violation
- return the full file content with the fix applied
