import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../../config/env';
import AppError from '../../utils/app-error';
import { authRepository } from './auth.repository';
import type { Role } from '../../types';

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const validateSignupPayload = (value: unknown) => {
    if (!isObject(value)) {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'Request body must be an object',
            },
        ]);
    }

    const errors: { field: string; message: string }[] = [];
    const allowedFields = ['name', 'email', 'password', 'role'];

    for (const field of Object.keys(value)) {
        if (!allowedFields.includes(field)) {
            errors.push({
                field,
                message: 'Field is not allowed',
            });
        }
    }

    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const email = typeof value.email === 'string' ? value.email.trim() : '';
    const password = typeof value.password === 'string' ? value.password : '';

    if (!name || name.length > 255) {
        errors.push({
            field: 'name',
            message: 'Must be a non-empty string of at most 255 characters',
        });
    }

    if (
        !email ||
        email.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        errors.push({
            field: 'email',
            message: 'Must be a valid email address',
        });
    }

    if (!password) {
        errors.push({
            field: 'password',
            message: 'Must be a non-empty string',
        });
    }

    let role: Role | undefined;

    if (value.role !== undefined) {
        if (value.role === 'attendee' || value.role === 'organizer') {
            role = value.role;
        } else {
            errors.push({
                field: 'role',
                message: 'Must be attendee or organizer',
            });
        }
    }

    if (errors.length > 0) {
        throw new AppError(400, 'Validation Error', errors);
    }

    return {
        name,
        email: email.toLowerCase(),
        password,
        ...(role !== undefined ? { role } : {}),
    };
};

const validateLoginPayload = (value: unknown) => {
    if (!isObject(value)) {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'Request body must be an object',
            },
        ]);
    }

    const errors: { field: string; message: string }[] = [];
    const allowedFields = ['email', 'password'];

    for (const field of Object.keys(value)) {
        if (!allowedFields.includes(field)) {
            errors.push({
                field,
                message: 'Field is not allowed',
            });
        }
    }

    const email = typeof value.email === 'string' ? value.email.trim() : '';
    const password = typeof value.password === 'string' ? value.password : '';

    if (
        !email ||
        email.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        errors.push({
            field: 'email',
            message: 'Must be a valid email address',
        });
    }

    if (!password) {
        errors.push({
            field: 'password',
            message: 'Must be a non-empty string',
        });
    }

    if (errors.length > 0) {
        throw new AppError(400, 'Validation Error', errors);
    }

    return {
        email: email.toLowerCase(),
        password,
    };
};

const registerUserIntoDB = async (value: unknown) => {
    const payload = validateSignupPayload(value);
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const result = await authRepository.createUser({
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        ...(payload.role !== undefined ? { role: payload.role } : {}),
    });

    if (!result) {
        throw new AppError(409, 'Email already registered');
    }

    return result;
};

const loginUserIntoDB = async (value: unknown) => {
    const payload = validateLoginPayload(value);
    const user = await authRepository.findUserByEmail(payload.email);

    if (!user) {
        throw new AppError(401, 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
        payload.password,
        user.password,
    );

    if (!passwordMatches) {
        throw new AppError(401, 'Invalid email or password');
    }

    const token = jwt.sign(
        {
            id: user.id,
            role: user.role,
        },
        config.jwt_secret,
        {
            expiresIn: config.jwt_expires_in,
        },
    );

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    };
};

export const authService = {
    registerUserIntoDB,
    loginUserIntoDB,
};
