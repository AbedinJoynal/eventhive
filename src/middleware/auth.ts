import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import { USER_ROLE } from '../types';
import type { Role } from '../types';

const auth = (...roles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authorization = req.headers.authorization?.trim();

        if (!authorization) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        const bearerToken = authorization.match(/^Bearer\s+(.+)$/i);
        const token = (bearerToken?.[1] ?? authorization).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized Token',
            });
        }

        try {
            const decoded = jwt.verify(token, config.jwt_secret);

            if (
                typeof decoded !== 'object' ||
                decoded === null ||
                typeof decoded.id !== 'number' ||
                !Number.isInteger(decoded.id) ||
                decoded.id <= 0 ||
                (decoded.role !== USER_ROLE.attendee &&
                    decoded.role !== USER_ROLE.organizer)
            ) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized',
                });
            }

            if (roles.length > 0 && !roles.includes(decoded.role)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden',
                });
            }

            req.user = {
                id: decoded.id,
                role: decoded.role,
            };
        } catch {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        next();
    };
};

export default auth;
