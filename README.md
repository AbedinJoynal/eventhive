# EventHive API

**Live API:** Add the public deployment URL after deployment.
**Interview video:** Add your public Google Drive or unlisted YouTube link.

EventHive is an API for community events and ticket bookings. Attendees can browse events and manage bookings. Organizers can create and manage their own events.

**Stack:** Node.js 22/24, TypeScript (strict), Express 5, PostgreSQL (`pg`), bcrypt, and JWT.
**Structure:** `route → controller → service → repository`; SQL is parameterized and there is no ORM.

## Setup

You’ll need Node.js 22 or 24, npm, and a PostgreSQL database such as Neon.

1. Install dependencies: `npm install`
2. Create `.env` in the project root using the example below. Replace the first two values with your Neon connection string and a long random secret.
3. Start the development server: `npm run dev`

The server creates the `users`, `events`, and `bookings` tables when it starts. The database user needs permission to create tables.

### Environment example

Keep real credentials in `.env` only. Use placeholders in this example; don’t commit secrets.

```env
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_random_secret
JWT_EXPIRES_IN=7d
PORT=5000
```

## Build and deploy

Set `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `PORT` in your deployment environment.

```bash
npm run build
vercel --prod
```

After deploying, add the public URL above. Add your interview video link before submitting.

## API

Local base URL: `http://localhost:5000`
Production base URL: `https://YOUR-VERCEL-DEPLOYMENT.vercel.app`

All paths below start with `/api/v1`.

### Authentication

Protected endpoints accept either header:

```http
Authorization: Bearer <JWT_TOKEN>
Authorization: <JWT_TOKEN>
```

The login token contains `id` and `role`.

### Response format

Success:

```json
{ "success": true, "message": "Operation description", "data": {} }
```

Error:

```json
{
    "success": false,
    "message": "Validation Error",
    "errors": [{ "field": "tickets_booked", "message": "Must be at least 1" }]
}
```

The `errors` array is included for validation errors and may be omitted for business-rule errors. Error responses never include stack traces or raw SQL errors.

### Response data fields

- **User:** `id`, `name`, `email`, `role`, `created_at`, `updated_at`. Password is never returned.
- **Login:** `token` and `user` with `id`, `name`, `email`, `role`.
- **Event:** `id`, `title`, `description`, `category`, `date`, `location`, `total_seats`, `available_seats`, `price`, `organizer_id`, `created_at`, `updated_at`. PostgreSQL decimal `price` is returned as a string.
- **Event details:** Event fields plus `organizer: { id, name, email }`.
- **Booking:** `id`, `event_id`, `attendee_id`, `tickets_booked`, `total_price`, `status`, `created_at`, `updated_at`. PostgreSQL decimal `total_price` is returned as a string.
- **Booking history item:** `id`, nested `event: { id, title, date, location }`, `tickets_booked`, `total_price`, `status`, `created_at`.

### Endpoints

#### 1. Sign up — `POST /api/v1/auth/signup`

Public. Body:

```json
{
    "name": "Sarah Connor",
    "email": "sarah@eventhive.com",
    "password": "securePassword123",
    "role": "organizer"
}
```

`role` is optional and defaults to `attendee`; allowed values are `attendee` and `organizer`.
**201:** `User registered successfully`; data is a User.
**Errors:** `400` invalid input; `409` email already registered.

#### 2. Log in — `POST /api/v1/auth/login`

Public. Body:

```json
{ "email": "sarah@eventhive.com", "password": "securePassword123" }
```

**200:** `Login successful`; data is Login.
**Errors:** `400` invalid input; `401` invalid email or password (same message for either case).

#### 3. Create event — `POST /api/v1/events`

Organizer only. Body fields: `title`, `description`, `category`, `date`, `location`, `total_seats`, `price`. The API takes `organizer_id` from the token and initializes `available_seats` to `total_seats`.

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

**201:** `Event created successfully`; data is an Event.
**Errors:** `400` invalid input; `401` missing/invalid token; `403` caller is not an organizer.

#### 4. List/search events — `GET /api/v1/events`

Public. Optional query: `?search=TypeScript`. Search is a case-insensitive partial match on title or description. Results are newest first.

**200:** `Events retrieved successfully`; data is an array of Events. No matches returns `data: []`.

#### 5. Get event — `GET /api/v1/events/:id`

Public. Data is Event details, including organizer ID, name, and email.
**200:** `Event retrieved successfully`.
**Errors:** `400` invalid ID; `404` event not found.

#### 6. Update event — `PATCH /api/v1/events/:id`

The organizer who created the event only. Send at least one of: `title`, `description`, `category`, `date`, `location`, `total_seats`, `price`. Only supplied fields change. When `total_seats` changes, `available_seats` becomes the new total minus confirmed tickets sold. The new total cannot be below tickets sold. A price change affects future bookings only.

Example body:

```json
{ "title": "TypeScript Masterclass", "total_seats": 60 }
```

**200:** `Event updated successfully`; data is an Event.
**Errors:** `400` invalid/empty body or seats below confirmed tickets sold; `401` missing/invalid token; `403` not the owner; `404` event not found.

#### 7. Delete event — `DELETE /api/v1/events/:id`

The organizer who created the event only. Deletion is blocked if any confirmed bookings exist. Cancelled bookings are deleted with the event.

**200:** `Event deleted successfully`; `data` is `null`.
**Errors:** `400` confirmed bookings prevent deletion; `401` missing/invalid token; `403` not the owner; `404` event not found.

#### 8. Book tickets — `POST /api/v1/bookings`

Any authenticated attendee or organizer. Body:

```json
{ "event_id": 1, "tickets_booked": 2 }
```

The event must exist, be in the future, and have enough seats. Organizers cannot book their own events. The API calculates the total price and reduces available seats.

**201:** `Tickets booked successfully`; data is a confirmed Booking.
**Errors:** `400` invalid input, event has passed, or not enough seats; `401` missing/invalid token; `403` booking own event; `404` event not found.

#### 9. Get my bookings — `GET /api/v1/bookings`

Any authenticated user. Returns only that user’s bookings, newest first.

**200:** `Bookings retrieved successfully`; data is an array of Booking history items. No bookings returns `data: []`.
**Error:** `401` missing/invalid token.

#### 10. Cancel booking — `PATCH /api/v1/bookings/:id/cancel`

Any authenticated user may cancel their own booking. Cancellation restores seats. A booking cannot be cancelled twice or after its event has started.

**200:** `Booking cancelled successfully`; data is a cancelled Booking.
**Errors:** `400` invalid ID or event has passed; `401` missing/invalid token; `403` booking belongs to another user; `404` booking not found; `409` already cancelled.

## Status codes

`200` success; `201` created; `400` invalid input or business rule; `401` missing/invalid/expired token; `403` insufficient role or ownership; `404` resource not found; `409` duplicate email or conflicting state; `500` unexpected server/database error.
