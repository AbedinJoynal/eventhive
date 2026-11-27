import type { Request, Response } from 'express';
import { authService } from './auth.service';
import sendResponse from '../../utils/send-response';

const signupUser = async (req: Request, res: Response) => {
    const result = await authService.registerUserIntoDB(req.body);

    sendResponse(res, {
        statusCode: 201,
        message: 'User registered successfully',
        data: result,
    });
};

const loginUser = async (req: Request, res: Response) => {
    const result = await authService.loginUserIntoDB(req.body);

    sendResponse(res, {
        statusCode: 200,
        message: 'Login successful',
        data: result,
    });
};

export const authController = {
    signupUser,
    loginUser,
};
