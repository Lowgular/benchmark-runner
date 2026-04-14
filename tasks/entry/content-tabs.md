# Content Tabs

The purpose of this application is to show simple tabs from stubbed json file and present it using Tailwind and Angular framework.

## File system

You are in greenfield Angular starter app and here are the files

{{> contextFiles '*.md, src/**/*.json, src/**/*.css, src/**/*.html, src/**/*.ts' }}

---

## Endpoints

You must use this endpoint in order to fetch the tabs content:
`GET https://storage.googleapis.com/lowgular-platform/mocks/tabs.json`

The endpoint will respond with the json looking similar to this one:

```ts
{
  "tab": string;
  "content": string; // can contain HTML
}[]
```

## Functional Requirements

The application must present tabs and display the corresponding content when a tab is selected.

The scenarios below assume the **API returns exactly 5 tabs** with these labels and content.

If the backend returns something else, behavior is undefined for this task.

```gherkin
Background:
  Given the API returns exactly 5 tabs with labels "Overview", "Details", "Settings", "History", "Help"
  And each tab has its own content string (with placeholder HTML)

Scenario: Tabs load from API and are visible
  Given the application fetches tab content from the API endpoint
  When I navigate to the "/" route
  Then I should see exactly 5 tabs
  And the first tab ("Overview") should be selected by default
  And the content area should show the first tab's content

Scenario: Selecting a tab shows its content
  Given the application has loaded the 5 tabs from the API
  And the first tab ("Overview") is currently selected
  When I click on the second tab ("Details")
  Then the "Details" tab becomes selected
  And the content area displays the second tab's ("Details") content

Scenario: Re-selecting the same tab does not break state
  Given the application has loaded the 5 tabs from the API
  And I have selected the "Help" tab
  When I click the "Help" tab again
  Then the Help content remains visible
  And the tab remains selected
```

### Out of Functional Scope

The following are explicitly NOT part of this task so DO NOT attempt to develp these features:

- Error handling (assume the API always succeeds)
- Loading states (no need to show loading indicators)

## Technical Requirements

IMPORTANT: for this task you do not need to setup routing - simply use a single `App` component.

Use the simple CMS (Component Model Service) architecture:

- Component - Do not write your own component, simply use app.ts and app.html to finish the task
- Model - you are required to create own model file
- Service - you are required to create own service file
- HttpClient - you must use HttpClient to fetch data from the specified endpoint

## UI Requirements

You MUST create the valid HTML that will represent tabs with containers.

It is important that you bind the correct data into HTML tags and that you showcase the 'selected' state.

IMPORTANT: The tailwind css is already added to the project so use its default utility classes.

We do not evaluate the visuals for this task, however as professional frontend developer you should take care that the app looks nice and is functional.
