import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import config from '../../config/env';
import AppError from '../../utils/app-error';
import { authRepository } from './auth.repository';
import type { Role } from '../../types';

const registerUserIntoDB = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
}) => {
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

const loginUserIntoDB = async (payload: {
    email: string;
    password: string;
}) => {
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
            expiresIn: config.jwt_expires_in as NonNullable<
                SignOptions['expiresIn']
            >,
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
