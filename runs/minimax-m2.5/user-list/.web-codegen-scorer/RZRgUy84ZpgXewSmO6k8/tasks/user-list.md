# User List

The purpose of this application is to show a simple list of users from stubbed json file and present it using Tailwind and Angular framework.

## File system

You are in greenfield Angular starter app and here are the files


---

## Endpoints

You must use this endpoint in order to fetch the product detail model:
`GET https://storage.googleapis.com/lowgular-platform/mocks/users.json`

The endpoint will respond with the json looking similar to this type:

```ts
  {
    id: number,
    email: string,
    avatarUrl: string,
    lastLoggedInAt: number, // epoch timestamp since last login
  }[];
```

## Functional Requirements

```gherkin
Given the application fetches users data from the API endpoint
When I navigate to the "/" route
Then I should see the list of users
```

### Out of Functional Scope

The following are explicitly NOT part of this task so DO NOT attempt to develp these features:

- Error handling (assume the API always succeeds)
- Loading states (no need to show loading indicators)
- Empty state (no need to show info that list is empty)

## Technical Requirements

IMPORTANT: for this task you do not need to setup routing - simply use a single `App` component.

Use the simple CMS (Component Model Service) architecture:

- Component - Do not write your own component, simply use app.ts and app.html to finish the task
- Model - you are required to create own model file
- Service - you are required to create own service file
- HttpClient - you must use HttpClient to fetch data from the specified endpoint

## UI Requirements

You MUST create the valid HTML that will represent a list with items representing user data.

It is important that you bind the correct data into HTML tags.

You must bind the following product properties:

- avatarUrl (small rounded image)
- email (main text showing the user's email)
- lastLoggedInAt (tiny text showing last login in European format: day-month-year 24h time without second, e.g. "02.02.2025, 14:30")

IMPORTANT: The tailwind css is already added to the project so use its default utility classes.

We do not evaluate the visuals for this task, however as professional frontend developer you should take care that the app looks nice and is functional.
