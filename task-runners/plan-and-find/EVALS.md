# Evals

## Level 0

find angular services
find services
find components

find signal properties

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)-[:HAS_TYPE_DECLARATION]->(t:TypeAliasDeclaration {name: 'Signal'}) WHERE t.filePath CONTAINS '@angular/core' RETURN c,p
```

find models

find query methods (methods returning)
find command methods (methods modifying state)

## Level 1

find standalone components
// readonly public properties?

find data services

### Resolving Type

find methods returning observable of team

```cypher
MATCH (m:MethodDeclaration)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(t:TypeAliasDeclaration {name: 'Team'}) RETURN m,t
```

## Level 2

### Template

find component signal properties that are used in template

```cypher
MATCH (c:ClassDeclaration)-[:HAS_MEMBER]->(p:PropertyDeclaration)-[:HAS_TYPE_DECLARATION]->(t:TypeAliasDeclaration|InterfaceDeclaration|ClassDeclaration)
WHERE t.name IN ["WritableSignal", "Signal", "InputSignal"] AND t.filePath CONTAINS '@angular/core'
MATCH (c)-[:HAS_TEMPLATE_BINDING]->(id:Identifier)
MATCH (id)-[:HAS_ANCESTOR]->(p)
RETURN c, p, t
```

find components that use built in directive in the template
find components that output / render team data
find components that use "TeamComponent" in their template
find components that pass on data via "x" input

### Structural (multi hop)

find data services

## Level 3

find models that are used in component and service

```cypher
MATCH (component:ClassDeclaration)-[:HAS_DECORATOR]->(:Decorator)-[:HAS_DESCENDANT]->(cid:Identifier {text: 'Component'})-[:HAS_SYMBOL_IMPORT]->(:ImportDeclaration {moduleSpecifier: '@angular/core'})
MATCH (component)-[:HAS_MEMBER]->(componentMember:PropertyDeclaration|MethodDeclaration)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(model:InterfaceDeclaration|TypeAliasDeclaration)
MATCH (service:ClassDeclaration)-[:HAS_DECORATOR]->(:Decorator)-[:HAS_DESCENDANT]->(sid:Identifier {text: 'Injectable'})-[:HAS_SYMBOL_IMPORT]->(:ImportDeclaration {moduleSpecifier: '@angular/core'})
MATCH (service)-[:HAS_MEMBER]->(serviceMember:PropertyDeclaration|MethodDeclaration)-[:HAS_DESCENDANT_TYPE_DECLARATION]->(model)
WHERE component.filePath CONTAINS 'web/src/app'
AND service.filePath CONTAINS 'web/src/app'
AND model.filePath CONTAINS 'web/src/app'
RETURN DISTINCT model.name, model.filePath, component.name, component.filePath, service.name, service.filePath
```

find smart components (component + data service)

find components that are routable and smart
find components that are used in more than 3 components and have more than 2 dependencies

## Level 4

find dependency chain that is between 2 and 5 hops

find max length prop drilling chain
