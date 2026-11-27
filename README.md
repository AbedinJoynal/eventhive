# EventHive – Event & Ticket Booking API

**Live API:** `PENDING — add your Vercel deployment URL`  
**Interview video:** `PENDING — add your public Google Drive or unlisted YouTube link`

EventHive is a REST API for user authentication, event management, and ticket booking. It supports attendee and organizer roles, event search, booking history, and seat inventory management.

## Features

- Sign up and log in with JWT authentication
- Role-based access for attendees and organizers
- Create, search, view, update, and delete events
- Book and cancel tickets
- Track available seats and calculate booking prices
- Validate requests and return consistent success and error responses
- Use PostgreSQL with parameterized queries

## Technology

- Node.js and TypeScript
- Express 5
- PostgreSQL with the `pg` package
- Neon PostgreSQL
- JWT authentication with `jsonwebtoken`
- Password hashing with `bcrypt`

## Project structure

```text
src/
├── app.ts
├── server.ts
├── config/
│   ├── db.ts
│   └── env.ts
├── middleware/
│   ├── auth.ts
│   ├── errorhandler.ts
│   └── index.d.ts
├── modules/
│   ├── auth/
│   ├── booking/
│   └── event/
├── types/
│   └── index.ts
└── utils/
    ├── app-error.ts
    └── send-response.ts
```

The modules follow a layered structure:

```text
route → controller → service → repository
```

Repositories contain the SQL queries. The project uses PostgreSQL’s `pg` package and parameterized queries; it does not use an ORM.

## Requirements

- Node.js and npm
- A PostgreSQL database, such as Neon

## Setup

1. Clone the repository and open the project directory.
2. Install the dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file in the project root and add the required variables. Keep `.env` private and do not commit it.
4. Start the development server:

    ```bash
    npm run dev
    ```

The application initializes the `users`, `events`, and `bookings` tables when the server starts. The database user must have permission to create tables.

### Environment variables

Create a `.env.example` file with placeholder values like these, then copy it to `.env` and add your actual credentials:

```env
DATABASE_URL=your_neon_postgresql_connection_string
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
PORT=5000
```

Do not put real database credentials or JWT secrets in `.env.example`.

## Build and start

After configuring the production build:

```bash
npm run build
npm start
```

## Deployment

The backend is intended for deployment on Vercel.

1. Add `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and any required `PORT` setting to the Vercel project environment variables.
2. Build the project using the configured production build.
3. Deploy from the project root:

    ```bash
    vercel --prod
    ```

Update the **Live API** link at the top of this README after deployment.

## API

### Base URL

Local development:

```text
http://localhost:5000/api/v1
```

Production:

```text
https://YOUR-VERCEL-DEPLOYMENT.vercel.app/api/v1
```

### Authentication

Protected endpoints accept either of these authorization header formats:

```http
Authorization: Bearer <JWT_TOKEN>
```

```http
Authorization: <JWT_TOKEN>
```

The token is returned by the login endpoint. It contains the authenticated user's `id` and `role`.

### Response format

Successful responses use this structure:

```json
{
    "success": true,
    "message": "Operation description",
    "data": {}
}
```

Error responses use this structure. The `errors` array is included for validation errors and may be omitted for business-rule errors:

```json
{
    "success": false,
    "message": "Validation Error",
    "errors": [
        {
            "field": "tickets_booked",
            "message": "Must be at least 1"
        }
    ]
}
```

### Endpoint summary

| Method   | Endpoint               | Access                 |
| -------- | ---------------------- | ---------------------- |
| `POST`   | `/auth/signup`         | Public                 |
| `POST`   | `/auth/login`          | Public                 |
| `POST`   | `/events`              | Organizer              |
| `GET`    | `/events`              | Public                 |
| `GET`    | `/events/:id`          | Public                 |
| `PATCH`  | `/events/:id`          | Event-owning organizer |
| `DELETE` | `/events/:id`          | Event-owning organizer |
| `POST`   | `/bookings`            | Authenticated user     |
| `GET`    | `/bookings`            | Authenticated user     |
| `PATCH`  | `/bookings/:id/cancel` | Booking owner          |

---

### 1. Register a user

`POST /auth/signup` — Public

The `role` is optional and defaults to `attendee`. Allowed roles are `attendee` and `organizer`.

Request:

```json
{
    "name": "Sarah Connor",
    "email": "sarah@eventhive.com",
    "password": "securePassword123",
    "role": "organizer"
}
```

Success — `201 Created`:

```json
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "id": 1,
        "name": "Sarah Connor",
        "email": "sarah@eventhive.com",
        "role": "organizer",
        "created_at": "2026-11-15T09:00:00.000Z",
        "updated_at": "2026-11-15T09:00:00.000Z"
    }
}
```

The password is hashed and is never returned.

Errors: `400` invalid input; `409` email already registered.

### 2. Log in

`POST /auth/login` — Public

Request:

```json
{
    "email": "sarah@eventhive.com",
    "password": "securePassword123"
}
```

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Login successful",
    "data": {
        "token": "<JWT_TOKEN>",
        "user": {
            "id": 1,
            "name": "Sarah Connor",
            "email": "sarah@eventhive.com",
            "role": "organizer"
        }
    }
}
```

Errors: `400` invalid input; `401` invalid email or password.

### 3. Create an event

`POST /events` — Organizer only

Requires an authorization header. The organizer ID is taken from the JWT, not from the request body. Available seats are initialized to the total seat count.

Request:

```json
{
    "title": "TypeScript Advanced Architecture",
    "description": "Deep dive into enterprise TS patterns and modular design.",
    "category": "tech",
    "date": "2026-12-10T10:00:00.000Z",
    "location": "Dhaka Tech Hub",
    "total_seats": 50,
    "price": 1500.0
}
```

Success — `201 Created`:

```json
{
    "success": true,
    "message": "Event created successfully",
    "data": {
        "id": 1,
        "title": "TypeScript Advanced Architecture",
        "description": "Deep dive into enterprise TS patterns and modular design.",
        "category": "tech",
        "date": "2026-12-10T10:00:00.000Z",
        "location": "Dhaka Tech Hub",
        "total_seats": 50,
        "available_seats": 50,
        "price": "1500.00",
        "organizer_id": 1,
        "created_at": "2026-11-15T10:30:00.000Z",
        "updated_at": "2026-11-15T10:30:00.000Z"
    }
}
```

Errors: `400` invalid input; `401` missing or invalid token; `403` caller is not an organizer.

### 4. Get all events

`GET /events` — Public

Events are ordered newest first. An optional `search` query performs a case-insensitive partial match on the title or description.

```text
GET /events?search=TypeScript
```

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Events retrieved successfully",
    "data": [
        {
            "id": 1,
            "title": "TypeScript Advanced Architecture",
            "description": "Deep dive into enterprise TS patterns and modular design.",
            "category": "tech",
            "date": "2026-12-10T10:00:00.000Z",
            "location": "Dhaka Tech Hub",
            "total_seats": 50,
            "available_seats": 50,
            "price": "1500.00",
            "organizer_id": 1,
            "created_at": "2026-11-15T10:30:00.000Z",
            "updated_at": "2026-11-15T10:30:00.000Z"
        }
    ]
}
```

An empty result returns `200 OK` with `"data": []`.

### 5. Get one event

`GET /events/:id` — Public

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Event retrieved successfully",
    "data": {
        "id": 1,
        "title": "TypeScript Advanced Architecture",
        "description": "Deep dive into enterprise TS patterns and modular design.",
        "category": "tech",
        "date": "2026-12-10T10:00:00.000Z",
        "location": "Dhaka Tech Hub",
        "total_seats": 50,
        "available_seats": 50,
        "price": "1500.00",
        "organizer_id": 1,
        "organizer": {
            "id": 1,
            "name": "Sarah Connor",
            "email": "sarah@eventhive.com"
        },
        "created_at": "2026-11-15T10:30:00.000Z",
        "updated_at": "2026-11-15T10:30:00.000Z"
    }
}
```

Errors: `400` invalid ID; `404` event not found.

### 6. Update an event

`PATCH /events/:id` — The organizer who created the event

Requires an authorization header. Include at least one updatable field. Only fields provided in the request are changed. If `total_seats` changes, available seats are recalculated as the new total minus confirmed tickets sold. The new total cannot be less than tickets already sold. A price change applies to future bookings only.

Updatable fields: `title`, `description`, `category`, `date`, `location`, `total_seats`, `price`.

Request:

```json
{
    "title": "TypeScript Masterclass",
    "total_seats": 60
}
```

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Event updated successfully",
    "data": {
        "id": 1,
        "title": "TypeScript Masterclass",
        "description": "Deep dive into enterprise TS patterns and modular design.",
        "category": "tech",
        "date": "2026-12-10T10:00:00.000Z",
        "location": "Dhaka Tech Hub",
        "total_seats": 60,
        "available_seats": 60,
        "price": "1500.00",
        "organizer_id": 1,
        "created_at": "2026-11-15T10:30:00.000Z",
        "updated_at": "2026-11-15T11:00:00.000Z"
    }
}
```

Errors: `400` invalid input, empty body, or total seats below confirmed tickets sold; `401` missing or invalid token; `403` not the event owner; `404` event not found.

### 7. Delete an event

`DELETE /events/:id` — The organizer who created the event

Requires an authorization header. An event with confirmed bookings cannot be deleted. Cancelled bookings are removed with the event.

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Event deleted successfully",
    "data": null
}
```

Errors: `400` event has confirmed bookings; `401` missing or invalid token; `403` not the event owner; `404` event not found.

### 8. Book tickets

`POST /bookings` — Authenticated attendee or organizer

Requires an authorization header. An organizer cannot book their own event. The event must not have passed and must have enough available seats. The total price is calculated by the API.

Request:

```json
{
    "event_id": 1,
    "tickets_booked": 2
}
```

Success — `201 Created`:

```json
{
    "success": true,
    "message": "Tickets booked successfully",
    "data": {
        "id": 1,
        "event_id": 1,
        "attendee_id": 2,
        "tickets_booked": 2,
        "total_price": "3000.00",
        "status": "confirmed",
        "created_at": "2026-11-15T11:15:00.000Z",
        "updated_at": "2026-11-15T11:15:00.000Z"
    }
}
```

Errors: `400` invalid input, insufficient seats, or event has passed; `401` missing or invalid token; `403` organizer is booking their own event; `404` event not found.

### 9. Get the authenticated user’s bookings

`GET /bookings` — Authenticated attendee or organizer

Requires an authorization header. Only the authenticated user’s bookings are returned, newest first.

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Bookings retrieved successfully",
    "data": [
        {
            "id": 1,
            "event": {
                "id": 1,
                "title": "TypeScript Masterclass",
                "date": "2026-12-10T10:00:00.000Z",
                "location": "Dhaka Tech Hub"
            },
            "tickets_booked": 2,
            "total_price": "3000.00",
            "status": "confirmed",
            "created_at": "2026-11-15T11:15:00.000Z"
        }
    ]
}
```

No bookings returns `200 OK` with `"data": []`.

Error: `401` missing or invalid token.

### 10. Cancel a booking

`PATCH /bookings/:id/cancel` — The authenticated owner of the booking

Requires an authorization header. A cancelled booking cannot be cancelled again. The event must not have passed. Cancelling restores the booked seats to the event.

Success — `200 OK`:

```json
{
    "success": true,
    "message": "Booking cancelled successfully",
    "data": {
        "id": 1,
        "event_id": 1,
        "attendee_id": 2,
        "tickets_booked": 2,
        "total_price": "3000.00",
        "status": "cancelled",
        "created_at": "2026-11-15T11:15:00.000Z",
        "updated_at": "2026-11-15T12:00:00.000Z"
    }
}
```

Errors: `400` invalid ID or event has passed; `401` missing or invalid token; `403` booking belongs to another user; `404` booking not found; `409` booking is already cancelled.

## HTTP status codes

| Status | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `200`  | Successful `GET`, `PATCH`, or `DELETE`                     |
| `201`  | Resource created successfully                              |
| `400`  | Validation failure or business rule prevents the operation |
| `401`  | Missing, invalid, or expired JWT                           |
| `403`  | Authenticated user lacks the required role or ownership    |
| `404`  | Requested resource not found                               |
| `409`  | Duplicate email or conflicting resource state              |
| `500`  | Unexpected server or database failure                      |

The API does not return stack traces or raw SQL errors in error responses.
