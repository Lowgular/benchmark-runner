## Data

---

Use https://fakestoreapi.com/

### Users

Get all

`GET https://fakestoreapi.com/users`

Get one

`GET https://fakestoreapi.com/users/1`

Update

`PUT https://fakestoreapi.com/users/1 body: { email:'John@gmail.com', username:'johnd', password:'m38rmF$', name: { firstname:'John', lastname:'Doe' }, }`

### Carts Get all user carts

`GET https://fakestoreapi.com/carts/user/2`

## Routes

---

- `/detail/:id` - detail route
- `/edit/:id` - edit route

## Tasks

---

#### 1. Main route

```
GIVEN I am on main route
THEN I should be redirected to the 'list' route.
```

#### 2. Menu

```
GIVEN I am on any route
THEN I should see a Bootstrap navigation menu with two item: "Shop Admin" header and "Users" link.
```

```
GIVEN I am on any route
WHEN I click on the Users link in the navigation menu
THEN I should be redirected to 'list' route.
```

#### 3. List Table

```
GIVEN I am on the 'list' route
THEN I should see a list of all users
AND each item in the list should have display the email address of the user
AND each item in the list should have a View "primary" button
AND each item in the list should have a Edit "secondary" button
```

```
GIVEN I am on the 'list' route
WHEN I click on the View button
THEN I should be redirected to the 'detail' route with dynamic parameter id of the selected user
```

```
GIVEN I am on the 'list' route
WHEN I click on the Edit button
THEN I should be redirected to the 'edit' route with dynamic parameter id of the selected user
```

#### 4. Details View

```
GIVEN I am on detail route
THEN I should see Personal Data of the user: (email, first name, last name)
AND I should see "Edit" primary button
```

```
GIVEN I am on the 'detail' route
THEN I should see the Carts list
AND each item in the Carts list should have Cart title numbered from 1
AND each item in the Carts list should have simple products lists with id and quantity of the product
```

```
GIVEN I am on the 'detail' route
WHEN I click on the Edit button
THEN I should be redirected to the 'edit' route with dynamic parameter id of selected user
```

#### 5. Edit View

```
GIVEN I am on the 'edit' route
THEN I should see a simple form with 4 fields: email, username, name, last name
AND I all fields should be initially filled with user data I am editing
AND I should see Save button
```

```
GIVEN I am on the 'edit' route
WHEN I click on the Save button
THEN the the user should be updated through the API
AND I should be redirected back to the 'list' route
```

## Requirements

---

- Use HttpClientModule to fetch data
- Use Bootstrap to style elements
- Use list-group-item class for list items ## Expected view

---

### List View

![expected image](https://cdn.staging.lowgular.academy/challenges/WFj4cbCBc2bjgfpSvACh/images/1_list_1_loaded.png)

### Detail View

![expected image](https://cdn.staging.lowgular.academy/ui-review/3hPA4rXUcGNYZndy8bg8/2_detail_1_loaded.png)

### Edit View

![expected image](https://cdn.staging.lowgular.academy/ui-review/3hPA4rXUcGNYZndy8bg8/3_edit_1_loaded.png)
