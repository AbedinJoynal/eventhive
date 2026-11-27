import { pool } from '../../config/db';

const initializeBookingsTable = async () => {
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

const createBooking = async (payload: {
    event_id: number;
    attendee_id: number;
    tickets_booked: number;
}) => {
    const { event_id, attendee_id, tickets_booked } = payload;
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
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
            [event_id],
        );

        const event = eventResult.rows[0];

        if (
            !event ||
            !event.event_is_upcoming ||
            event.available_seats < tickets_booked
        ) {
            await client.query('ROLLBACK');
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
            [tickets_booked, event_id],
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
            [event_id, attendee_id, tickets_booked],
        );

        if (!result.rows[0]) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return result.rows[0];
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        throw error;
    } finally {
        client.release();
    }
};

const getUserBookings = async (attendeeId: number) => {
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
        [attendeeId],
    );

    return result.rows;
};

const getBookingById = async (bookingId: number) => {
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
        [bookingId],
    );

    return result.rows[0] ?? null;
};

const cancelBooking = async (bookingId: number, attendeeId: number) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
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
            [bookingId],
        );

        const booking = bookingResult.rows[0];

        if (
            !booking ||
            booking.attendee_id !== attendeeId ||
            booking.status !== 'confirmed' ||
            !booking.event_is_upcoming
        ) {
            await client.query('ROLLBACK');
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
            [bookingId, attendeeId],
        );

        if (!result.rows[0]) {
            await client.query('ROLLBACK');
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
            [booking.tickets_booked, booking.event_id],
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return result.rows[0];
    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        throw error;
    } finally {
        client.release();
    }
};

export const bookingRepository = {
    initializeBookingsTable,
    createBooking,
    getUserBookings,
    getBookingById,
    cancelBooking,
};
