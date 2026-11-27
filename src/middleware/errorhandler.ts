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

    if (
        err instanceof SyntaxError &&
        'status' in err &&
        err.status === 400 &&
        'type' in err &&
        err.type === 'entity.parse.failed'
    ) {
        res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: [
                {
                    field: 'body',
                    message: 'Request body contains invalid JSON',
                },
            ],
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
    });
};

export default errorHandler;
