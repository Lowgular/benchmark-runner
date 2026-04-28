# class-decorator

## useCase

When expanding on `ClassDeclaration` that has `Decorator` with some specific search requirements

## whenToUse

- User intent asks for classes by decorator meaning.
- Intent provides or implies a decorator identifier.
- Import-source grounding may be required for disambiguation.

## Base Match Statement

If this is what the user is asking, then you should use this base match statement (that is part of bigger query):

```cypher
MATCH (c:ClassDeclaration)-[:HAS_DECORATOR]->(cd:Decorator)
```

On top of this, user intent can add additional constraints that should be applied incrementally.

## Assembly order

Build query fragments in this order:

1. Base class + decorator match
2. Decorator identifier constraint
3. Optional identifier import-source grounding
4. Optional decorator metadata/property checks
5. Optional absence/default checks (`WHERE <propVar> IS NULL`)

### Identifier

On top of the base query the use can mention that it should be decorator with specific: name, identifier or text. In this case you should add another match statement (based on variable names from previous query):

```cypher
MATCH (cd)-[:HAS_DESCENDANT]->(cdi:Identifier { text: '<decoratorName>' })
```

#### Identifier from

Identifier can be found in many places so you might want to increase accuracy resolving semantic meaning.

For example: User can ask that `Injectable` Decorator comes from `@angular/core` package in this case you can add one more match statement:

```cypher
MATCH (cdi)-[:HAS_SYMBOL_IMPORT]->(imp:ImportDeclaration { moduleSpecifier: '<moduleSpecifier>' })
```

### Decorator properties

User might want to check a specific property in the decorator.

In order to do so you first need to add match query for `ObjectLiteralExpression`:

```cypher
MATCH (cd)-[:HAS_DESCENDANT]->(cdo:ObjectLiteralExpression)
```

and then target the actual property:

```cypher
OPTIONAL MATCH (cdo)-[:HAS_PROPERTY]->(cdoprop:PropertyAssignment { name: 'changeDetection' })
```

We have used OPTIONAL MATCH on purpose because it could be that property is not present but this is not a problem because it means a default value

#### Property Initializer

When you need a specific property value, keep property lookup optional and check value in `WHERE`:

```cypher
OPTIONAL MATCH (cdo)-[:HAS_PROPERTY]->(cdoprop:PropertyAssignment { name: '<propertyName>' })
WHERE cdoprop.initializer = '<propertyValue>'
```

#### Lack of property (default value)

To model default behavior where the property is missing:

```cypher
OPTIONAL MATCH (cdo)-[:HAS_PROPERTY]->(cdoprop:PropertyAssignment { name: '<propertyName>' })
WHERE cdoprop IS NULL
```

#### Property value OR default (missing property)

When intent means "property equals value OR property missing", compose both branches with one optional lookup.

Compact pattern to append after your base decorator matches:

```cypher
OPTIONAL MATCH (cdo)-[:HAS_PROPERTY]->(cdoprop:PropertyAssignment { name: '<propertyName>' })
WHERE cdoprop IS NULL OR cdoprop.initializer = '<propertyValue>'
```

This keeps semantics correct:

- branch A: property exists and matches `<propertyValue>`
- branch B: property is absent (default)

Important: if you write `MATCH ... PropertyAssignment { name: '<propertyName>', initializer: '<propertyValue>' }`,
you exclude the default/missing branch and change query semantics.

## antiPatterns

- Matching decorator text without `Identifier` anchoring.
- Omitting import-source grounding when intent requires source disambiguation.
- Using short labels like `Class` instead of `ClassDeclaration`.
- Replacing `property value OR property absent` semantics with only `property value`.
