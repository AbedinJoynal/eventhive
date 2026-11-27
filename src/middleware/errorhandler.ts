import type { NextFunction, Request, Response } from 'express';
import AppError from '../utils/app-error';

const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    console.error(err.stack);

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            ...(err.errors ? { errors: err.errors } : {}),
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
    });
};

export default errorHandler;
