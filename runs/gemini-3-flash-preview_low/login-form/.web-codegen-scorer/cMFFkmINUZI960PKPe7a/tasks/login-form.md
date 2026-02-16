# Login Form

The purpose of this application is to show a simple form submission.

## File system

You are in greenfield Angular starter app and here are the files


---

## Endpoints

You must use this endpoint in order to fetch the product detail model:
`POST https://us-central1-lowgular-platform-c0e93.cloudfunctions.net/api/mock/login`

Request body format:

```json
{
  "email": "string representing email to be logged in",
  "password": "string representing password for the email"
}
```

The endpoint will respond with this json format:

```json
{
  "accessToken": "string representing jwt simplest format"
}
```

## Functional Requirements

```gherkin
Given I am on the "/" router
When I fill up the "email" field with the value "test@lowgular.io"
And I fill up the "password" field with the value "test"
And I press "submit"
Then I should see "logged in successfully" message
```

### Out of Functional Scope

The following are explicitly NOT part of this task so DO NOT attempt to develp these features:

- Routing and navigating to another route
- Error handling (assume the API always succeeds)
- Loading states (no need to show loading indicators)

## Technical Requirements

IMPORTANT: for this task you do not need to setup routing - simply use a single `App` component and show the state change as part of internal component state.

Use the simple CMS (Component Model Service) architecture:

- Component - Do not write your own component, simply use app.ts and app.html to finish the task
- Model - you are required to create own model file
- Service - you are required to create own service file
- HttpClient - you must use HttpClient to fetch data from the specified endpoint

## UI Requirements

You MUST create the valid HTML that will represent a login form.

It is important that you show the correct form fields and bind them into Http Request.

You must bind the following form fiels:

- email (input text)
- password (input password)
- submit button

IMPORTANT: The tailwind css is already added to the project so use its default utility classes.

We do not evaluate the visuals for this task, however as professional frontend developer you should take care that the app looks nice and is functional.
