# Edit Resource Form

The purpose of this application is to show a simple edit form submission.

## File system

You are in greenfield Angular starter app and here are the files

{{> contextFiles '*.md, src/**/*.json, src/**/*.css, src/**/*.html, src/**/*.ts' }}

---

## Endpoints

You must use these endpoints to fetch and update comment data:

### Get single comment

Request
`GET https://us-central1-lowgular-platform-c0e93.cloudfunctions.net/api/mock/comments/:id`

Response
status: 200

Body format:

```ts
{
  id: number,
  title: string,
  content: string
}
```

### Update Comment

Request
`PUT https://us-central1-lowgular-platform-c0e93.cloudfunctions.net/api/mock/comments/:id`

Body:

```ts
{
  title: string,
  content: string,
}
```

Response: 204 and No body

## Functional Requirements

```gherkin
Scenario: Form shows existing comment data
  Given there is a comment with id 1 (with title and content)
  When I enter the route "/comments/1" and the page loads
  Then I should see the form filled with that comment's data (title and content)

Scenario: Edit and save shows success message and redirects to main
  Given there is a comment with id 1
  And I have entered the route "/comments/1" and the form has loaded
  When I fill up the "title" field with a new value
  And I fill up the "content" field with a longer value (e.g. several sentences, for the text area)
  And I press "Save" (or submit)
  Then I should see a "successfully saved" message
  And I should be redirected to the main route "/"
```

### Out of Functional Scope

The following are explicitly NOT part of this task so DO NOT attempt to develop these features:

- Error handling (assume the API always succeeds)
- Loading states (no need to show loading indicators)
- Content on the main route "/" (empty is fine)

## Technical Requirements

IMPORTANT: You must set up routing. Use route "/comments/:id" for the edit form and route "/" as the main route. The main route "/" can be empty. After a successful save (PUT returns 2xx), navigate the user to "/".

Use the simple CMS (Component Model Service) architecture:

- Component - Use app and route-level components as needed (e.g. app.ts/app.html plus components for "/" and "/comments/:id")
- Model - you are required to create a model file for the comment
- Service - you are required to create a service file
- HttpClient - you must use HttpClient to fetch (GET) and update (PUT) via the endpoints above

## UI Requirements

You MUST create the valid HTML for the **edit comment form** on the `/comments/:id` route.

It is important that you show the correct form fields and bind them to the comment data (from GET) and to the update request (PUT on submit).

You must include the following:

- **title** – single-line input (e.g. `input type="text"`), bound to the comment title
- **content** – multi-line input (e.g. `textarea`), bound to the comment content (longer text)
- **Save** (or Submit) button – on click, send PUT with current title and content, then on success redirect to "/"

The form should be pre-filled with the comment loaded from the API (GET by id). Use appropriate labels and structure so the form is clear and usable.

IMPORTANT: The Tailwind CSS is already added to the project; use its default utility classes.

We do not evaluate the visuals for this task, however as a professional frontend developer you should take care that the app looks nice and is functional.
