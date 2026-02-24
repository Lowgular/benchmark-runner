Your task is to refactor the codebase according the the sarif report generated with violations and use existing skill descriptions in order to improve the code

## Report

You will see the Sarif report file that contains all the violations, you MUST use it to improve the code base.

For each rule you need to pay extra attention to following properties:

- `properties.skill` optional property that will point you to specific skill that MUST be applied to fix the code. The property is optional and if is present then you MUST run the skill for all the locations in results. If the property is NOT PRESENT then you MUST NOT run that skill and you can ignore the rule violations
- `results` this represent all of the places where rule was violated
  - `locations` property explaining where to find the violations

## Relevant files:

These are relevant files that you MUST use to perform the improvements.

You will see:

- files in `src/app` folder to be modified
- files in `skills` folder to be used in order to improve the codebase
- report.sarif - files describing what is wrong, where to find it and which skill to use

{{> contextFiles 'src/**/*.json, src/**/*.css, src/**/*.html, src/**/*.ts, skills/**/*.md, result.sarif' }}

---

Now go ahead and perform the improvements
