# Angular 20 Greenfield Project

Fresh Angular 20 starter with standalone components, Zone.js, and HttpClient pre-configured.

## Configuration

- **Angular**: 20.1.2
- **Change Detection**: Zone.js with event coalescing
- **Routing**: None
- **CSS**: Plain (no preprocessor)
- **HttpClient**: Enabled

## Structure

```
src/
├── main.ts              # Bootstrap with providers
├── index.html           # Entry HTML
└── app/
    ├── app.component.ts   # Root component (standalone)
    └── app.component.html # Root template (empty)
```

## Setup

Requires Node.js 22+

```bash
npm install
npm start
```

Runs at `http://localhost:4200`
