import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
});

const port = process.env.PORT;
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
}

if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
}

const config = {
    port,
    database_url: databaseUrl,
    jwt_secret: jwtSecret,
    jwt_expires_in: jwtExpiresIn,
};

export default config;