import type { Request, Response } from 'express';
import { bookingService } from './booking.service';
import sendResponse from '../../utils/send-response';

const bookEventTickets = async (req: Request, res: Response) => {
    const result = await bookingService.bookEventTickets(
        req.body,
        req.user!.id,
    );

    sendResponse(res, {
        statusCode: 201,
        message: 'Tickets booked successfully',
        data: result,
    });
};

const getUserBookings = async (req: Request, res: Response) => {
    const result = await bookingService.getUserBookings(req.user!.id);

    sendResponse(res, {
        statusCode: 200,
        message: 'Bookings retrieved successfully',
        data: result,
    });
};

const cancelBooking = async (req: Request, res: Response) => {
    const result = await bookingService.cancelBooking(
        String(req.params.id),
        req.user!.id,
    );

    sendResponse(res, {
        statusCode: 200,
        message: 'Booking cancelled successfully',
        data: result,
    });
};

export const bookingController = {
    bookEventTickets,
    getUserBookings,
    cancelBooking,
};
