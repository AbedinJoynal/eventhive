
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    

// src/app.ts
import express from "express";

// src/modules/auth/auth.route.ts
import { Router } from "express";

// src/modules/auth/auth.service.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// src/config/env.ts
import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), ".env")
});
var port = process.env.PORT;
var databaseUrl = process.env.DATABASE_URL;
var jwtSecret = process.env.JWT_SECRET;
var jwtExpiresInValue = process.env.JWT_EXPIRES_IN;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}
if (!jwtExpiresInValue) {
  throw new Error("JWT_EXPIRES_IN is required");
}
var config = {
  port,
  database_url: databaseUrl,
  jwt_secret: jwtSecret,
  jwt_expires_in: jwtExpiresInValue
};
var env_default = config;

// src/utils/app-error.ts
var AppError = class extends Error {
  statusCode;
  errors;
  constructor(statusCode, message, errors) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
};
var app_error_default = AppError;

// src/config/db.ts
import { Pool } from "pg";
var pool = new Pool({
  connectionString: env_default.database_url
});

// src/modules/auth/auth.repository.ts
var initializeUsersTable = async () => {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'attendee'
                CHECK (role IN ('attendee', 'organizer')),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);
};
var findUserByEmail = async (email) => {
  const result = await pool.query(
    `
        SELECT * FROM users WHERE email = $1
        `,
    [email]
  );
  return result.rows[0] ?? null;
};
var createUser = async (payload) => {
  const { name, email, password, role } = payload;
  const result = await pool.query(
    `
        INSERT INTO users (name, email, password, role) VALUES
        ($1, $2, $3, COALESCE($4, 'attendee'))
        ON CONFLICT (email) DO NOTHING
        RETURNING id, name, email, role, created_at, updated_at
        `,
    [name, email, password, role ?? null]
  );
  return result.rows[0] ?? null;
};
var authRepository = {
  initializeUsersTable,
  findUserByEmail,
  createUser
};

// src/modules/auth/auth.service.ts
var isObject = (value) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
var validateSignupPayload = (value) => {
  if (!isObject(value)) {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "Request body must be an object"
      }
    ]);
  }
  const errors = [];
  const allowedFields = ["name", "email", "password", "role"];
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      errors.push({
        field,
        message: "Field is not allowed"
      });
    }
  }
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  if (!name || name.length > 255) {
    errors.push({
      field: "name",
      message: "Must be a non-empty string of at most 255 characters"
    });
  }
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({
      field: "email",
      message: "Must be a valid email address"
    });
  }
  if (!password) {
    errors.push({
      field: "password",
      message: "Must be a non-empty string"
    });
  }
  let role;
  if (value.role !== void 0) {
    if (value.role === "attendee" || value.role === "organizer") {
      role = value.role;
    } else {
      errors.push({
        field: "role",
        message: "Must be attendee or organizer"
      });
    }
  }
  if (errors.length > 0) {
    throw new app_error_default(400, "Validation Error", errors);
  }
  return {
    name,
    email: email.toLowerCase(),
    password,
    ...role !== void 0 ? { role } : {}
  };
};
var validateLoginPayload = (value) => {
  if (!isObject(value)) {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "Request body must be an object"
      }
    ]);
  }
  const errors = [];
  const allowedFields = ["email", "password"];
  for (const field of Object.keys(value)) {
    if (!allowedFields.includes(field)) {
      errors.push({
        field,
        message: "Field is not allowed"
      });
    }
  }
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const password = typeof value.password === "string" ? value.password : "";
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({
      field: "email",
      message: "Must be a valid email address"
    });
  }
  if (!password) {
    errors.push({
      field: "password",
      message: "Must be a non-empty string"
    });
  }
  if (errors.length > 0) {
    throw new app_error_default(400, "Validation Error", errors);
  }
  return {
    email: email.toLowerCase(),
    password
  };
};
var registerUserIntoDB = async (value) => {
  const payload = validateSignupPayload(value);
  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const result = await authRepository.createUser({
    name: payload.name,
    email: payload.email,
    password: hashedPassword,
    ...payload.role !== void 0 ? { role: payload.role } : {}
  });
  if (!result) {
    throw new app_error_default(409, "Email already registered");
  }
  return result;
};
var loginUserIntoDB = async (value) => {
  const payload = validateLoginPayload(value);
  const user = await authRepository.findUserByEmail(payload.email);
  if (!user) {
    throw new app_error_default(401, "Invalid email or password");
  }
  const passwordMatches = await bcrypt.compare(
    payload.password,
    user.password
  );
  if (!passwordMatches) {
    throw new app_error_default(401, "Invalid email or password");
  }
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    env_default.jwt_secret,
    {
      expiresIn: env_default.jwt_expires_in
    }
  );
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};
var authService = {
  registerUserIntoDB,
  loginUserIntoDB
};

// src/utils/send-response.ts
var sendResponse = (res, data) => {
  res.status(data.statusCode).json({
    success: true,
    message: data.message,
    data: data.data
  });
};
var send_response_default = sendResponse;

// src/modules/auth/auth.controller.ts
var signupUser = async (req, res) => {
  const result = await authService.registerUserIntoDB(req.body);
  send_response_default(res, {
    statusCode: 201,
    message: "User registered successfully",
    data: result
  });
};
var loginUser = async (req, res) => {
  const result = await authService.loginUserIntoDB(req.body);
  send_response_default(res, {
    statusCode: 200,
    message: "Login successful",
    data: result
  });
};
var authController = {
  signupUser,
  loginUser
};

// src/modules/auth/auth.route.ts
var router = Router();
router.post("/signup", authController.signupUser);
router.post("/login", authController.loginUser);
var authRoute = router;

// src/modules/event/event.route.ts
import { Router as Router2 } from "express";

// src/middleware/auth.ts
import jwt2 from "jsonwebtoken";

// src/types/index.ts
var USER_ROLE = {
  attendee: "attendee",
  organizer: "organizer"
};

// src/middleware/auth.ts
var auth = (...roles) => {
  return (req, res, next) => {
    const authorization = req.headers.authorization?.trim();
    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }
    const bearerToken = authorization.match(/^Bearer\s+(.+)$/i);
    const token = (bearerToken?.[1] ?? authorization).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized Token"
      });
    }
    try {
      const decoded = jwt2.verify(token, env_default.jwt_secret);
      if (typeof decoded !== "object" || decoded === null || typeof decoded.id !== "number" || !Number.isInteger(decoded.id) || decoded.id <= 0 || decoded.role !== USER_ROLE.attendee && decoded.role !== USER_ROLE.organizer) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });
      }
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden"
        });
      }
      req.user = {
        id: decoded.id,
        role: decoded.role
      };
    } catch {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }
    next();
  };
};
var auth_default = auth;

// src/modules/event/event.repository.ts
var initializeEventsTable = async () => {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(100) NOT NULL,
            date TIMESTAMP NOT NULL,
            location VARCHAR(255) NOT NULL,
            total_seats INTEGER NOT NULL CHECK (total_seats > 0),
            available_seats INTEGER NOT NULL
                CHECK (
                    available_seats >= 0
                    AND available_seats <= total_seats
                ),
            price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
            organizer_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);
};
var createEvent = async (payload, organizerId) => {
  const { title, description, category, date, location, total_seats, price } = payload;
  const result = await pool.query(
    `
        INSERT INTO events (
            title,
            description,
            category,
            date,
            location,
            total_seats,
            available_seats,
            price,
            organizer_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8)
        RETURNING *
        `,
    [
      title,
      description,
      category,
      date,
      location,
      total_seats,
      price,
      organizerId
    ]
  );
  return result.rows[0] ?? null;
};
var getAllEvents = async (search) => {
  const searchValue = search ? `%${search}%` : null;
  const result = await pool.query(
    `
        SELECT *
        FROM events
        WHERE (
            $1::TEXT IS NULL
            OR title ILIKE $1
            OR description ILIKE $1
        )
        ORDER BY created_at DESC
        `,
    [searchValue]
  );
  return result.rows;
};
var getEventById = async (eventId) => {
  const result = await pool.query(
    `
        SELECT
            events.*,
            json_build_object(
                'id', users.id,
                'name', users.name,
                'email', users.email
            ) AS organizer
        FROM events
        INNER JOIN users ON users.id = events.organizer_id
        WHERE events.id = $1
        `,
    [eventId]
  );
  return result.rows[0] ?? null;
};
var getConfirmedTicketsCount = async (eventId) => {
  const result = await pool.query(
    `
        SELECT COALESCE(SUM(tickets_booked), 0)::INTEGER AS tickets_sold
        FROM bookings
        WHERE event_id = $1
          AND status = 'confirmed'
        `,
    [eventId]
  );
  return Number(result.rows[0].tickets_sold);
};
var updateEvent = async (eventId, organizerId, payload) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const eventResult = await client.query(
      `
            SELECT id
            FROM events
            WHERE id = $1
              AND organizer_id = $2
            FOR UPDATE
            `,
      [eventId, organizerId]
    );
    if (!eventResult.rows[0]) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    const updates = [];
    const values = [];
    const fields = [
      { column: "title", value: payload.title },
      { column: "description", value: payload.description },
      { column: "category", value: payload.category },
      { column: "date", value: payload.date },
      { column: "location", value: payload.location },
      { column: "price", value: payload.price }
    ];
    for (const field of fields) {
      if (field.value !== void 0) {
        values.push(field.value);
        updates.push(`${field.column} = $${values.length}`);
      }
    }
    if (payload.total_seats !== void 0) {
      const ticketsResult = await client.query(
        `
                SELECT COALESCE(SUM(tickets_booked), 0)::INTEGER AS tickets_sold
                FROM bookings
                WHERE event_id = $1
                  AND status = 'confirmed'
                `,
        [eventId]
      );
      const ticketsSold = Number(ticketsResult.rows[0].tickets_sold);
      if (payload.total_seats < ticketsSold) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return null;
      }
      values.push(payload.total_seats);
      updates.push(`total_seats = $${values.length}`);
      values.push(payload.total_seats - ticketsSold);
      updates.push(`available_seats = $${values.length}`);
    }
    if (updates.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    updates.push("updated_at = NOW()");
    values.push(eventId);
    const eventIdPosition = values.length;
    values.push(organizerId);
    const organizerIdPosition = values.length;
    const result = await client.query(
      `
            UPDATE events
            SET ${updates.join(", ")}
            WHERE id = $${eventIdPosition}
              AND organizer_id = $${organizerIdPosition}
            RETURNING *
            `,
      values
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return result.rows[0] ?? null;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};
var deleteEvent = async (eventId, organizerId) => {
  const result = await pool.query(
    `
        DELETE FROM events
        WHERE id = $1
          AND organizer_id = $2
          AND NOT EXISTS (
              SELECT 1
              FROM bookings
              WHERE event_id = $1
                AND status = 'confirmed'
          )
        RETURNING id
        `,
    [eventId, organizerId]
  );
  return result.rows[0] ?? null;
};
var eventRepository = {
  initializeEventsTable,
  createEvent,
  getAllEvents,
  getEventById,
  getConfirmedTicketsCount,
  updateEvent,
  deleteEvent
};

// src/modules/event/event.service.ts
var parseEventId = (id) => {
  const eventId = typeof id === "string" ? Number(id) : Number.NaN;
  if (!Number.isInteger(eventId) || eventId < 1) {
    throw new app_error_default(400, "Invalid event id");
  }
  return eventId;
};
var throwValidationErrors = (errors) => {
  if (errors.length > 0) {
    throw new app_error_default(400, "Validation Error", errors);
  }
};
var createEvent2 = async (payload, organizerId) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "Request body must be an object"
      }
    ]);
  }
  const errors = [];
  if (typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 255) {
    errors.push({
      field: "title",
      message: "Must be a non-empty string of at most 255 characters"
    });
  }
  if (typeof payload.description !== "string" || !payload.description.trim()) {
    errors.push({
      field: "description",
      message: "Must be a non-empty string"
    });
  }
  if (typeof payload.category !== "string" || !payload.category.trim() || payload.category.length > 100) {
    errors.push({
      field: "category",
      message: "Must be a non-empty string of at most 100 characters"
    });
  }
  if (typeof payload.date !== "string" || Number.isNaN(Date.parse(payload.date))) {
    errors.push({
      field: "date",
      message: "Must be a valid date"
    });
  }
  if (typeof payload.location !== "string" || !payload.location.trim() || payload.location.length > 255) {
    errors.push({
      field: "location",
      message: "Must be a non-empty string of at most 255 characters"
    });
  }
  if (!Number.isInteger(payload.total_seats) || payload.total_seats < 1) {
    errors.push({
      field: "total_seats",
      message: "Must be a positive integer"
    });
  }
  if (typeof payload.price !== "number" || !Number.isFinite(payload.price) || payload.price < 0) {
    errors.push({
      field: "price",
      message: "Must be a number greater than or equal to 0"
    });
  }
  throwValidationErrors(errors);
  const event = await eventRepository.createEvent(
    {
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category.trim(),
      date: payload.date,
      location: payload.location.trim(),
      total_seats: payload.total_seats,
      price: payload.price
    },
    organizerId
  );
  if (!event) {
    throw new app_error_default(500, "Failed to create event");
  }
  return event;
};
var getAllEvents2 = async (search) => {
  return eventRepository.getAllEvents(search);
};
var getSingleEvent = async (id) => {
  const eventId = parseEventId(id);
  const event = await eventRepository.getEventById(eventId);
  if (!event) {
    throw new app_error_default(404, "Event not found");
  }
  return event;
};
var updateEvent2 = async (id, payload, organizerId, userRole) => {
  const eventId = parseEventId(id);
  const event = await eventRepository.getEventById(eventId);
  if (!event) {
    throw new app_error_default(404, "Event not found");
  }
  if (userRole !== USER_ROLE.organizer || event.organizer_id !== organizerId) {
    throw new app_error_default(
      403,
      "You do not have permission to update this event"
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "Request body must be an object"
      }
    ]);
  }
  const hasUpdates = payload.title !== void 0 || payload.description !== void 0 || payload.category !== void 0 || payload.date !== void 0 || payload.location !== void 0 || payload.total_seats !== void 0 || payload.price !== void 0;
  if (!hasUpdates) {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "At least one updatable field is required"
      }
    ]);
  }
  const errors = [];
  if (payload.title !== void 0 && (typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 255)) {
    errors.push({
      field: "title",
      message: "Must be a non-empty string of at most 255 characters"
    });
  }
  if (payload.description !== void 0 && (typeof payload.description !== "string" || !payload.description.trim())) {
    errors.push({
      field: "description",
      message: "Must be a non-empty string"
    });
  }
  if (payload.category !== void 0 && (typeof payload.category !== "string" || !payload.category.trim() || payload.category.length > 100)) {
    errors.push({
      field: "category",
      message: "Must be a non-empty string of at most 100 characters"
    });
  }
  if (payload.date !== void 0 && (typeof payload.date !== "string" || Number.isNaN(Date.parse(payload.date)))) {
    errors.push({
      field: "date",
      message: "Must be a valid date"
    });
  }
  if (payload.location !== void 0 && (typeof payload.location !== "string" || !payload.location.trim() || payload.location.length > 255)) {
    errors.push({
      field: "location",
      message: "Must be a non-empty string of at most 255 characters"
    });
  }
  if (payload.total_seats !== void 0 && (!Number.isInteger(payload.total_seats) || payload.total_seats < 1)) {
    errors.push({
      field: "total_seats",
      message: "Must be a positive integer"
    });
  }
  if (payload.price !== void 0 && (typeof payload.price !== "number" || !Number.isFinite(payload.price) || payload.price < 0)) {
    errors.push({
      field: "price",
      message: "Must be a number greater than or equal to 0"
    });
  }
  throwValidationErrors(errors);
  if (payload.total_seats !== void 0) {
    const ticketsSold = await eventRepository.getConfirmedTicketsCount(eventId);
    if (payload.total_seats < ticketsSold) {
      throw new app_error_default(
        400,
        "total_seats cannot be lower than confirmed tickets sold"
      );
    }
  }
  const updatedEvent = await eventRepository.updateEvent(
    eventId,
    organizerId,
    payload
  );
  if (updatedEvent) {
    return updatedEvent;
  }
  const currentEvent = await eventRepository.getEventById(eventId);
  if (!currentEvent) {
    throw new app_error_default(404, "Event not found");
  }
  if (currentEvent.organizer_id !== organizerId) {
    throw new app_error_default(
      403,
      "You do not have permission to update this event"
    );
  }
  if (payload.total_seats !== void 0) {
    const ticketsSold = await eventRepository.getConfirmedTicketsCount(eventId);
    if (payload.total_seats < ticketsSold) {
      throw new app_error_default(
        400,
        "total_seats cannot be lower than confirmed tickets sold"
      );
    }
  }
  throw new app_error_default(500, "Failed to update event");
};
var deleteEvent2 = async (id, organizerId, userRole) => {
  const eventId = parseEventId(id);
  const event = await eventRepository.getEventById(eventId);
  if (!event) {
    throw new app_error_default(404, "Event not found");
  }
  if (userRole !== USER_ROLE.organizer || event.organizer_id !== organizerId) {
    throw new app_error_default(
      403,
      "You do not have permission to delete this event"
    );
  }
  const ticketsSold = await eventRepository.getConfirmedTicketsCount(eventId);
  if (ticketsSold > 0) {
    throw new app_error_default(
      400,
      "Event has confirmed bookings and cannot be deleted"
    );
  }
  const deletedEvent = await eventRepository.deleteEvent(
    eventId,
    organizerId
  );
  if (deletedEvent) {
    return deletedEvent;
  }
  const currentEvent = await eventRepository.getEventById(eventId);
  if (!currentEvent) {
    throw new app_error_default(404, "Event not found");
  }
  if (currentEvent.organizer_id !== organizerId) {
    throw new app_error_default(
      403,
      "You do not have permission to delete this event"
    );
  }
  const currentTicketsSold = await eventRepository.getConfirmedTicketsCount(eventId);
  if (currentTicketsSold > 0) {
    throw new app_error_default(
      400,
      "Event has confirmed bookings and cannot be deleted"
    );
  }
  throw new app_error_default(500, "Failed to delete event");
};
var eventService = {
  createEvent: createEvent2,
  getAllEvents: getAllEvents2,
  getSingleEvent,
  updateEvent: updateEvent2,
  deleteEvent: deleteEvent2
};

// src/modules/event/event.controller.ts
var createEvent3 = async (req, res) => {
  const result = await eventService.createEvent(req.body, req.user.id);
  send_response_default(res, {
    statusCode: 201,
    message: "Event created successfully",
    data: result
  });
};
var getAllEvents3 = async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : void 0;
  const result = await eventService.getAllEvents(search);
  send_response_default(res, {
    statusCode: 200,
    message: "Events retrieved successfully",
    data: result
  });
};
var getSingleEvent2 = async (req, res) => {
  const result = await eventService.getSingleEvent(req.params.id);
  send_response_default(res, {
    statusCode: 200,
    message: "Event retrieved successfully",
    data: result
  });
};
var updateEvent3 = async (req, res) => {
  const result = await eventService.updateEvent(
    req.params.id,
    req.body,
    req.user.id,
    req.user.role
  );
  send_response_default(res, {
    statusCode: 200,
    message: "Event updated successfully",
    data: result
  });
};
var deleteEvent3 = async (req, res) => {
  await eventService.deleteEvent(req.params.id, req.user.id, req.user.role);
  send_response_default(res, {
    statusCode: 200,
    message: "Event deleted successfully",
    data: null
  });
};
var eventController = {
  createEvent: createEvent3,
  getAllEvents: getAllEvents3,
  getSingleEvent: getSingleEvent2,
  updateEvent: updateEvent3,
  deleteEvent: deleteEvent3
};

// src/modules/event/event.route.ts
var router2 = Router2();
router2.post("/", auth_default(USER_ROLE.organizer), eventController.createEvent);
router2.get("/", eventController.getAllEvents);
router2.get("/:id", eventController.getSingleEvent);
router2.patch("/:id", auth_default(), eventController.updateEvent);
router2.delete("/:id", auth_default(), eventController.deleteEvent);
var eventRoute = router2;

// src/modules/booking/booking.route.ts
import { Router as Router3 } from "express";

// src/modules/booking/booking.repository.ts
var initializeBookingsTable = async () => {
  await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL
                REFERENCES events(id) ON DELETE CASCADE,
            attendee_id INTEGER NOT NULL REFERENCES users(id),
            tickets_booked INTEGER NOT NULL
                CHECK (tickets_booked > 0),
            total_price NUMERIC(10, 2) NOT NULL
                CHECK (total_price >= 0),
            status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'cancelled')),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    `);
};
var createBooking = async (payload) => {
  const { event_id, attendee_id, tickets_booked } = payload;
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const eventResult = await client.query(
      `
            SELECT
                id,
                available_seats,
                (date > NOW()) AS event_is_upcoming
            FROM events
            WHERE id = $1
            FOR UPDATE
            `,
      [event_id]
    );
    const event = eventResult.rows[0];
    if (!event || !event.event_is_upcoming || event.available_seats < tickets_booked) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    await client.query(
      `
            UPDATE events
            SET
                available_seats = available_seats - $1,
                updated_at = NOW()
            WHERE id = $2
            `,
      [tickets_booked, event_id]
    );
    const result = await client.query(
      `
            INSERT INTO bookings (
                event_id,
                attendee_id,
                tickets_booked,
                total_price,
                status
            )
            SELECT
                events.id,
                $2,
                $3,
                events.price * $3::INTEGER,
                'confirmed'
            FROM events
            WHERE events.id = $1
            RETURNING
                id,
                event_id,
                attendee_id,
                tickets_booked,
                total_price,
                status,
                created_at,
                updated_at
            `,
      [event_id, attendee_id, tickets_booked]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    await client.query("COMMIT");
    transactionStarted = false;
    return result.rows[0];
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};
var getUserBookings = async (attendeeId) => {
  const result = await pool.query(
    `
        SELECT
            bookings.id,
            bookings.event_id,
            events.title AS event_title,
            events.date AS event_date,
            events.location AS event_location,
            bookings.tickets_booked,
            bookings.total_price,
            bookings.status,
            bookings.created_at
        FROM bookings
        INNER JOIN events ON events.id = bookings.event_id
        WHERE bookings.attendee_id = $1
        ORDER BY bookings.created_at DESC
        `,
    [attendeeId]
  );
  return result.rows;
};
var getBookingById = async (bookingId) => {
  const result = await pool.query(
    `
        SELECT
            bookings.id,
            bookings.event_id,
            bookings.attendee_id,
            bookings.tickets_booked,
            bookings.total_price,
            bookings.status,
            bookings.created_at,
            bookings.updated_at,
            events.date AS event_date
        FROM bookings
        INNER JOIN events ON events.id = bookings.event_id
        WHERE bookings.id = $1
        `,
    [bookingId]
  );
  return result.rows[0] ?? null;
};
var cancelBooking = async (bookingId, attendeeId) => {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const bookingResult = await client.query(
      `
            SELECT
                bookings.id,
                bookings.event_id,
                bookings.attendee_id,
                bookings.tickets_booked,
                bookings.status,
                (events.date > NOW()) AS event_is_upcoming
            FROM bookings
            INNER JOIN events ON events.id = bookings.event_id
            WHERE bookings.id = $1
            FOR UPDATE OF bookings, events
            `,
      [bookingId]
    );
    const booking = bookingResult.rows[0];
    if (!booking || booking.attendee_id !== attendeeId || booking.status !== "confirmed" || !booking.event_is_upcoming) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    const result = await client.query(
      `
            UPDATE bookings
            SET
                status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
              AND attendee_id = $2
              AND status = 'confirmed'
            RETURNING
                id,
                event_id,
                attendee_id,
                tickets_booked,
                total_price,
                status,
                created_at,
                updated_at
            `,
      [bookingId, attendeeId]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }
    await client.query(
      `
            UPDATE events
            SET
                available_seats = available_seats + $1,
                updated_at = NOW()
            WHERE id = $2
            `,
      [booking.tickets_booked, booking.event_id]
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return result.rows[0];
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
};
var bookingRepository = {
  initializeBookingsTable,
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking
};

// src/modules/booking/booking.service.ts
var bookEventTickets = async (payload, attendeeId) => {
  if (!payload || typeof payload !== "object") {
    throw new app_error_default(400, "Validation Error", [
      {
        field: "body",
        message: "Request body must be an object"
      }
    ]);
  }
  const errors = [];
  if (!Number.isInteger(payload.event_id) || payload.event_id < 1) {
    errors.push({
      field: "event_id",
      message: "Must be a positive integer"
    });
  }
  if (!Number.isInteger(payload.tickets_booked) || payload.tickets_booked < 1) {
    errors.push({
      field: "tickets_booked",
      message: "Must be at least 1"
    });
  }
  if (errors.length > 0) {
    throw new app_error_default(400, "Validation Error", errors);
  }
  const event = await eventRepository.getEventById(payload.event_id);
  if (!event) {
    throw new app_error_default(404, "Event not found");
  }
  if (event.organizer_id === attendeeId) {
    throw new app_error_default(403, "You cannot book tickets for your own event");
  }
  if (new Date(event.date).getTime() <= Date.now()) {
    throw new app_error_default(
      400,
      "Cannot book tickets for an event that has passed"
    );
  }
  if (event.available_seats < payload.tickets_booked) {
    throw new app_error_default(400, "Insufficient available seats for this event");
  }
  const booking = await bookingRepository.createBooking({
    event_id: payload.event_id,
    attendee_id: attendeeId,
    tickets_booked: payload.tickets_booked
  });
  if (booking) {
    return booking;
  }
  const currentEvent = await eventRepository.getEventById(payload.event_id);
  if (!currentEvent) {
    throw new app_error_default(404, "Event not found");
  }
  if (new Date(currentEvent.date).getTime() <= Date.now()) {
    throw new app_error_default(
      400,
      "Cannot book tickets for an event that has passed"
    );
  }
  if (currentEvent.available_seats < payload.tickets_booked) {
    throw new app_error_default(400, "Insufficient available seats for this event");
  }
  throw new app_error_default(409, "Booking could not be completed. Please try again");
};
var getUserBookings2 = async (attendeeId) => {
  const bookings = await bookingRepository.getUserBookings(attendeeId);
  return bookings.map((booking) => ({
    id: booking.id,
    event: {
      id: booking.event_id,
      title: booking.event_title,
      date: booking.event_date,
      location: booking.event_location
    },
    tickets_booked: booking.tickets_booked,
    total_price: booking.total_price,
    status: booking.status,
    created_at: booking.created_at
  }));
};
var cancelBooking2 = async (id, attendeeId) => {
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    throw new app_error_default(400, "Invalid booking id");
  }
  const booking = await bookingRepository.getBookingById(bookingId);
  if (!booking) {
    throw new app_error_default(404, "Booking not found");
  }
  if (booking.attendee_id !== attendeeId) {
    throw new app_error_default(
      403,
      "You do not have permission to cancel this booking"
    );
  }
  if (booking.status === "cancelled") {
    throw new app_error_default(409, "Booking has already been cancelled");
  }
  if (new Date(booking.event_date).getTime() <= Date.now()) {
    throw new app_error_default(
      400,
      "Cannot cancel a booking after the event has started"
    );
  }
  const cancelledBooking = await bookingRepository.cancelBooking(
    bookingId,
    attendeeId
  );
  if (cancelledBooking) {
    return cancelledBooking;
  }
  const currentBooking = await bookingRepository.getBookingById(bookingId);
  if (!currentBooking) {
    throw new app_error_default(404, "Booking not found");
  }
  if (currentBooking.attendee_id !== attendeeId) {
    throw new app_error_default(
      403,
      "You do not have permission to cancel this booking"
    );
  }
  if (currentBooking.status === "cancelled") {
    throw new app_error_default(409, "Booking has already been cancelled");
  }
  if (new Date(currentBooking.event_date).getTime() <= Date.now()) {
    throw new app_error_default(
      400,
      "Cannot cancel a booking after the event has started"
    );
  }
  throw new app_error_default(409, "Booking could not be cancelled. Please try again");
};
var bookingService = {
  bookEventTickets,
  getUserBookings: getUserBookings2,
  cancelBooking: cancelBooking2
};

// src/modules/booking/booking.controller.ts
var bookEventTickets2 = async (req, res) => {
  const result = await bookingService.bookEventTickets(
    req.body,
    req.user.id
  );
  send_response_default(res, {
    statusCode: 201,
    message: "Tickets booked successfully",
    data: result
  });
};
var getUserBookings3 = async (req, res) => {
  const result = await bookingService.getUserBookings(req.user.id);
  send_response_default(res, {
    statusCode: 200,
    message: "Bookings retrieved successfully",
    data: result
  });
};
var cancelBooking3 = async (req, res) => {
  const result = await bookingService.cancelBooking(
    String(req.params.id),
    req.user.id
  );
  send_response_default(res, {
    statusCode: 200,
    message: "Booking cancelled successfully",
    data: result
  });
};
var bookingController = {
  bookEventTickets: bookEventTickets2,
  getUserBookings: getUserBookings3,
  cancelBooking: cancelBooking3
};

// src/modules/booking/booking.route.ts
var router3 = Router3();
router3.post(
  "/",
  auth_default(USER_ROLE.attendee, USER_ROLE.organizer),
  bookingController.bookEventTickets
);
router3.get(
  "/",
  auth_default(USER_ROLE.attendee, USER_ROLE.organizer),
  bookingController.getUserBookings
);
router3.patch(
  "/:id/cancel",
  auth_default(USER_ROLE.attendee, USER_ROLE.organizer),
  bookingController.cancelBooking
);
var bookingRoute = router3;

// src/middleware/errorhandler.ts
var errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  if (err instanceof app_error_default) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...err.errors ? { errors: err.errors } : {}
    });
    return;
  }
  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: [
        {
          field: "body",
          message: "Request body contains invalid JSON"
        }
      ]
    });
    return;
  }
  res.status(500).json({
    success: false,
    message: "Internal Server Error"
  });
};
var errorhandler_default = errorHandler;

// src/app.ts
var app = express();
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/events", eventRoute);
app.use("/api/v1/bookings", bookingRoute);
app.use(errorhandler_default);
var app_default = app;

// src/server.ts
var main = async () => {
  try {
    await authRepository.initializeUsersTable();
    await eventRepository.initializeEventsTable();
    await bookingRepository.initializeBookingsTable();
    console.log("Database Connected !!!");
    app_default.listen(env_default.port, () => {
      console.log("Server is running on port:", env_default.port);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};
main();
//# sourceMappingURL=server.js.map