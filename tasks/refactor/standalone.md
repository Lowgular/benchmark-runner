Refactor the provided file to resolve the following rule violation.

## VIOLATION

Rule:
Do not explicitly set the standalone property on Angular decorators.
In Angular 20, standalone defaults to true.

Why this is suboptimal:
The property is redundant and increases code verbosity.

## TARGET IMPROVEMENT

Remove explicit standalone configuration and rely on framework defaults.

## REFERENCE EXAMPLE

Before:

```ts
@Component({
standalone: true
})
```

After:

```ts
@Component({
})
```

## FILE TO REFACTOR

{{> contextFiles 'src/app/app.ts' }}
