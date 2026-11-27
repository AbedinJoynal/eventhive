import { pool } from '../../config/db';

const initializeEventsTable = async () => {
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

const createEvent = async (
    payload: {
        title: string;
        description: string;
        category: string;
        date: string;
        location: string;
        total_seats: number;
        price: number;
    },
    organizerId: number,
) => {
    const { title, description, category, date, location, total_seats, price } =
        payload;

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
            organizerId,
        ],
    );

    return result.rows[0] ?? null;
};

const getAllEvents = async (search?: string) => {
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
        [searchValue],
    );

    return result.rows;
};

const getEventById = async (eventId: number) => {
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
        [eventId],
    );

    return result.rows[0] ?? null;
};

const getConfirmedTicketsCount = async (eventId: number) => {
    const result = await pool.query(
        `
        SELECT COALESCE(SUM(tickets_booked), 0)::INTEGER AS tickets_sold
        FROM bookings
        WHERE event_id = $1
          AND status = 'confirmed'
        `,
        [eventId],
    );

    return Number(result.rows[0].tickets_sold);
};

const updateEvent = async (
    eventId: number,
    organizerId: number,
    payload: {
        title?: string;
        description?: string;
        category?: string;
        date?: string;
        location?: string;
        total_seats?: number;
        price?: number;
    },
) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const eventResult = await client.query(
            `
            SELECT id
            FROM events
            WHERE id = $1
              AND organizer_id = $2
            FOR UPDATE
            `,
            [eventId, organizerId],
        );

        if (!eventResult.rows[0]) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        const updates: string[] = [];
        const values: (string | number)[] = [];

        const fields = [
            { column: 'title', value: payload.title },
            { column: 'description', value: payload.description },
            { column: 'category', value: payload.category },
            { column: 'date', value: payload.date },
            { column: 'location', value: payload.location },
            { column: 'price', value: payload.price },
        ];

        for (const field of fields) {
            if (field.value !== undefined) {
                values.push(field.value);
                updates.push(`${field.column} = $${values.length}`);
            }
        }

        if (payload.total_seats !== undefined) {
            const ticketsResult = await client.query(
                `
                SELECT COALESCE(SUM(tickets_booked), 0)::INTEGER AS tickets_sold
                FROM bookings
                WHERE event_id = $1
                  AND status = 'confirmed'
                `,
                [eventId],
            );

            const ticketsSold = Number(ticketsResult.rows[0].tickets_sold);

            if (payload.total_seats < ticketsSold) {
                await client.query('ROLLBACK');
                transactionStarted = false;
                return null;
            }

            values.push(payload.total_seats);
            updates.push(`total_seats = $${values.length}`);

            values.push(payload.total_seats - ticketsSold);
            updates.push(`available_seats = $${values.length}`);
        }

        if (updates.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        updates.push('updated_at = NOW()');

        values.push(eventId);
        const eventIdPosition = values.length;

        values.push(organizerId);
        const organizerIdPosition = values.length;

        const result = await client.query(
            `
            UPDATE events
            SET ${updates.join(', ')}
            WHERE id = $${eventIdPosition}
              AND organizer_id = $${organizerIdPosition}
            RETURNING *
            `,
            values,
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return result.rows[0] ?? null;
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        throw error;
    } finally {
        client.release();
    }
};

const deleteEvent = async (eventId: number, organizerId: number) => {
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
        [eventId, organizerId],
    );

    return result.rows[0] ?? null;
};

export const eventRepository = {
    initializeEventsTable,
    createEvent,
    getAllEvents,
    getEventById,
    getConfirmedTicketsCount,
    updateEvent,
    deleteEvent,
};
