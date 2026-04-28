# Constraint: standalone-property

## Intent fragment

Expand the component or directive `Decorator` with:

### standalone (default — property absent or true):

- has descendant `ObjectLiteralExpression`
  - has `PropertyAssignment` with name `standalone` with initializer `true`
  - or does not have `PropertyAssignment` with name `standalone`

### not standalone:

- has descendant `ObjectLiteralExpression`
  - has `PropertyAssignment` with name `standalone` with initializer `false`
