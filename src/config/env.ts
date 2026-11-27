import dotenv from 'dotenv';
import type { SignOptions } from 'jsonwebtoken';
import path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
});

const port = process.env.PORT;
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresInValue = process.env.JWT_EXPIRES_IN;

if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
}

if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
}

if (!jwtExpiresInValue) {
    throw new Error('JWT_EXPIRES_IN is required');
}

const config = {
    port,
    database_url: databaseUrl,
    jwt_secret: jwtSecret,
    jwt_expires_in: jwtExpiresInValue as NonNullable<SignOptions['expiresIn']>,
};

export default config;
