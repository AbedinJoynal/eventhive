import { pool } from '../../config/db';
import type { Role } from '../../types';

const initializeUsersTable = async () => {
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

const findUserByEmail = async (email: string) => {
    const result = await pool.query(
        `
        SELECT * FROM users WHERE email = $1
        `,
        [email],
    );

    return result.rows[0] ?? null;
};

const createUser = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
}) => {
    const { name, email, password, role } = payload;

    const result = await pool.query(
        `
        INSERT INTO users (name, email, password, role) VALUES
        ($1, $2, $3, COALESCE($4, 'attendee'))
        ON CONFLICT (email) DO NOTHING
        RETURNING id, name, email, role, created_at, updated_at
        `,
        [name, email, password, role ?? null],
    );

    return result.rows[0] ?? null;
};

export const authRepository = {
    initializeUsersTable,
    findUserByEmail,
    createUser,
};
