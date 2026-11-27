import type { Request, Response } from 'express';
import { bookingService } from './booking.service';

const bookEventTickets = async (req: Request, res: Response) => {
    const result = await bookingService.bookEventTickets(
        req.body,
        req.user!.id,
    );

    res.status(201).json({
        success: true,
        message: 'Tickets booked successfully',
        data: result,
    });
};

const getUserBookings = async (req: Request, res: Response) => {
    const result = await bookingService.getUserBookings(req.user!.id);

    res.status(200).json({
        success: true,
        message: 'Bookings retrieved successfully',
        data: result,
    });
};

const cancelBooking = async (req: Request, res: Response) => {
    const result = await bookingService.cancelBooking(
        String(req.params.id),
        req.user!.id,
    );

    res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        data: result,
    });
};

export const bookingController = {
    bookEventTickets,
    getUserBookings,
    cancelBooking,
};
