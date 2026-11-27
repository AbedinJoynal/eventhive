import AppError from '../../utils/app-error';
import { bookingRepository } from './booking.repository';
import { eventRepository } from '../event/event.repository';

const bookEventTickets = async (
    payload: {
        event_id: number;
        tickets_booked: number;
    },
    attendeeId: number,
) => {
    if (!payload || typeof payload !== 'object') {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'Request body must be an object',
            },
        ]);
    }

    const errors: { field: string; message: string }[] = [];

    if (!Number.isInteger(payload.event_id) || payload.event_id < 1) {
        errors.push({
            field: 'event_id',
            message: 'Must be a positive integer',
        });
    }

    if (
        !Number.isInteger(payload.tickets_booked) ||
        payload.tickets_booked < 1
    ) {
        errors.push({
            field: 'tickets_booked',
            message: 'Must be at least 1',
        });
    }

    if (errors.length > 0) {
        throw new AppError(400, 'Validation Error', errors);
    }

    const event = await eventRepository.getEventById(payload.event_id);

    if (!event) {
        throw new AppError(404, 'Event not found');
    }

    if (event.organizer_id === attendeeId) {
        throw new AppError(403, 'You cannot book tickets for your own event');
    }

    if (new Date(event.date).getTime() <= Date.now()) {
        throw new AppError(
            400,
            'Cannot book tickets for an event that has passed',
        );
    }

    if (event.available_seats < payload.tickets_booked) {
        throw new AppError(400, 'Insufficient available seats for this event');
    }

    const booking = await bookingRepository.createBooking({
        event_id: payload.event_id,
        attendee_id: attendeeId,
        tickets_booked: payload.tickets_booked,
    });

    if (booking) {
        return booking;
    }

    const currentEvent = await eventRepository.getEventById(payload.event_id);

    if (!currentEvent) {
        throw new AppError(404, 'Event not found');
    }

    if (new Date(currentEvent.date).getTime() <= Date.now()) {
        throw new AppError(
            400,
            'Cannot book tickets for an event that has passed',
        );
    }

    if (currentEvent.available_seats < payload.tickets_booked) {
        throw new AppError(400, 'Insufficient available seats for this event');
    }

    throw new AppError(409, 'Booking could not be completed. Please try again');
};

const getUserBookings = async (attendeeId: number) => {
    const bookings = await bookingRepository.getUserBookings(attendeeId);

    return bookings.map((booking) => ({
        id: booking.id,
        event: {
            id: booking.event_id,
            title: booking.event_title,
            date: booking.event_date,
            location: booking.event_location,
        },
        tickets_booked: booking.tickets_booked,
        total_price: booking.total_price,
        status: booking.status,
        created_at: booking.created_at,
    }));
};

const cancelBooking = async (id: string, attendeeId: number) => {
    const bookingId = Number(id);

    if (!Number.isInteger(bookingId) || bookingId < 1) {
        throw new AppError(400, 'Invalid booking id');
    }

    const booking = await bookingRepository.getBookingById(bookingId);

    if (!booking) {
        throw new AppError(404, 'Booking not found');
    }

    if (booking.attendee_id !== attendeeId) {
        throw new AppError(
            403,
            'You do not have permission to cancel this booking',
        );
    }

    if (booking.status === 'cancelled') {
        throw new AppError(409, 'Booking has already been cancelled');
    }

    if (new Date(booking.event_date).getTime() <= Date.now()) {
        throw new AppError(
            400,
            'Cannot cancel a booking after the event has started',
        );
    }

    const cancelledBooking = await bookingRepository.cancelBooking(
        bookingId,
        attendeeId,
    );

    if (cancelledBooking) {
        return cancelledBooking;
    }

    const currentBooking = await bookingRepository.getBookingById(bookingId);

    if (!currentBooking) {
        throw new AppError(404, 'Booking not found');
    }

    if (currentBooking.attendee_id !== attendeeId) {
        throw new AppError(
            403,
            'You do not have permission to cancel this booking',
        );
    }

    if (currentBooking.status === 'cancelled') {
        throw new AppError(409, 'Booking has already been cancelled');
    }

    if (new Date(currentBooking.event_date).getTime() <= Date.now()) {
        throw new AppError(
            400,
            'Cannot cancel a booking after the event has started',
        );
    }

    throw new AppError(409, 'Booking could not be cancelled. Please try again');
};

export const bookingService = {
    bookEventTickets,
    getUserBookings,
    cancelBooking,
};
