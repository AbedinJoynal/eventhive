import AppError from '../../utils/app-error';
import { eventRepository } from './event.repository';

const parseEventId = (id: string | string[] | undefined) => {
    const eventId = typeof id === 'string' ? Number(id) : Number.NaN;

    if (!Number.isInteger(eventId) || eventId < 1) {
        throw new AppError(400, 'Invalid event id');
    }

    return eventId;
};

const throwValidationErrors = (
    errors: { field: string; message: string }[],
) => {
    if (errors.length > 0) {
        throw new AppError(400, 'Validation Error', errors);
    }
};

const createEvent = async (
    payload: {
        title: string;
        description: string;
        category: string;
        date: string;
        location: string;
        total_seats: number;
        price: number;
    },
    organizerId: number,
) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'Request body must be an object',
            },
        ]);
    }

    const errors: { field: string; message: string }[] = [];

    if (
        typeof payload.title !== 'string' ||
        !payload.title.trim() ||
        payload.title.length > 255
    ) {
        errors.push({
            field: 'title',
            message: 'Must be a non-empty string of at most 255 characters',
        });
    }

    if (
        typeof payload.description !== 'string' ||
        !payload.description.trim()
    ) {
        errors.push({
            field: 'description',
            message: 'Must be a non-empty string',
        });
    }

    if (
        typeof payload.category !== 'string' ||
        !payload.category.trim() ||
        payload.category.length > 100
    ) {
        errors.push({
            field: 'category',
            message: 'Must be a non-empty string of at most 100 characters',
        });
    }

    if (
        typeof payload.date !== 'string' ||
        Number.isNaN(Date.parse(payload.date))
    ) {
        errors.push({
            field: 'date',
            message: 'Must be a valid date',
        });
    }

    if (
        typeof payload.location !== 'string' ||
        !payload.location.trim() ||
        payload.location.length > 255
    ) {
        errors.push({
            field: 'location',
            message: 'Must be a non-empty string of at most 255 characters',
        });
    }

    if (!Number.isInteger(payload.total_seats) || payload.total_seats < 1) {
        errors.push({
            field: 'total_seats',
            message: 'Must be a positive integer',
        });
    }

    if (
        typeof payload.price !== 'number' ||
        !Number.isFinite(payload.price) ||
        payload.price < 0
    ) {
        errors.push({
            field: 'price',
            message: 'Must be a number greater than or equal to 0',
        });
    }

    throwValidationErrors(errors);

    const event = await eventRepository.createEvent(
        {
            title: payload.title.trim(),
            description: payload.description.trim(),
            category: payload.category.trim(),
            date: payload.date,
            location: payload.location.trim(),
            total_seats: payload.total_seats,
            price: payload.price,
        },
        organizerId,
    );

    if (!event) {
        throw new AppError(500, 'Failed to create event');
    }

    return event;
};

const getAllEvents = async (search?: string) => {
    return eventRepository.getAllEvents(search);
};

const getSingleEvent = async (id: string | string[] | undefined) => {
    const eventId = parseEventId(id);
    const event = await eventRepository.getEventById(eventId);

    if (!event) {
        throw new AppError(404, 'Event not found');
    }

    return event;
};

const updateEvent = async (
    id: string | string[] | undefined,
    payload: {
        title?: string;
        description?: string;
        category?: string;
        date?: string;
        location?: string;
        total_seats?: number;
        price?: number;
    },
    organizerId: number,
) => {
    const eventId = parseEventId(id);
    const event = await eventRepository.getEventById(eventId);

    if (!event) {
        throw new AppError(404, 'Event not found');
    }

    if (event.organizer_id !== organizerId) {
        throw new AppError(
            403,
            'You do not have permission to update this event',
        );
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'Request body must be an object',
            },
        ]);
    }

    const hasUpdates =
        payload.title !== undefined ||
        payload.description !== undefined ||
        payload.category !== undefined ||
        payload.date !== undefined ||
        payload.location !== undefined ||
        payload.total_seats !== undefined ||
        payload.price !== undefined;

    if (!hasUpdates) {
        throw new AppError(400, 'Validation Error', [
            {
                field: 'body',
                message: 'At least one updatable field is required',
            },
        ]);
    }

    const errors: { field: string; message: string }[] = [];

    if (
        payload.title !== undefined &&
        (typeof payload.title !== 'string' ||
            !payload.title.trim() ||
            payload.title.length > 255)
    ) {
        errors.push({
            field: 'title',
            message: 'Must be a non-empty string of at most 255 characters',
        });
    }

    if (
        payload.description !== undefined &&
        (typeof payload.description !== 'string' || !payload.description.trim())
    ) {
        errors.push({
            field: 'description',
            message: 'Must be a non-empty string',
        });
    }

    if (
        payload.category !== undefined &&
        (typeof payload.category !== 'string' ||
            !payload.category.trim() ||
            payload.category.length > 100)
    ) {
        errors.push({
            field: 'category',
            message: 'Must be a non-empty string of at most 100 characters',
        });
    }

    if (
        payload.date !== undefined &&
        (typeof payload.date !== 'string' ||
            Number.isNaN(Date.parse(payload.date)))
    ) {
        errors.push({
            field: 'date',
            message: 'Must be a valid date',
        });
    }

    if (
        payload.location !== undefined &&
        (typeof payload.location !== 'string' ||
            !payload.location.trim() ||
            payload.location.length > 255)
    ) {
        errors.push({
            field: 'location',
            message: 'Must be a non-empty string of at most 255 characters',
        });
    }

    if (
        payload.total_seats !== undefined &&
        (!Number.isInteger(payload.total_seats) || payload.total_seats < 1)
    ) {
        errors.push({
            field: 'total_seats',
            message: 'Must be a positive integer',
        });
    }

    if (
        payload.price !== undefined &&
        (typeof payload.price !== 'number' ||
            !Number.isFinite(payload.price) ||
            payload.price < 0)
    ) {
        errors.push({
            field: 'price',
            message: 'Must be a number greater than or equal to 0',
        });
    }

    throwValidationErrors(errors);

    if (payload.total_seats !== undefined) {
        const ticketsSold =
            await eventRepository.getConfirmedTicketsCount(eventId);

        if (payload.total_seats < ticketsSold) {
            throw new AppError(
                400,
                'total_seats cannot be lower than confirmed tickets sold',
            );
        }
    }

    const updatedEvent = await eventRepository.updateEvent(
        eventId,
        organizerId,
        payload,
    );

    if (updatedEvent) {
        return updatedEvent;
    }

    const currentEvent = await eventRepository.getEventById(eventId);

    if (!currentEvent) {
        throw new AppError(404, 'Event not found');
    }

    if (currentEvent.organizer_id !== organizerId) {
        throw new AppError(
            403,
            'You do not have permission to update this event',
        );
    }

    if (payload.total_seats !== undefined) {
        const ticketsSold =
            await eventRepository.getConfirmedTicketsCount(eventId);

        if (payload.total_seats < ticketsSold) {
            throw new AppError(
                400,
                'total_seats cannot be lower than confirmed tickets sold',
            );
        }
    }

    throw new AppError(500, 'Failed to update event');
};

const deleteEvent = async (
    id: string | string[] | undefined,
    organizerId: number,
) => {
    const eventId = parseEventId(id);
    const event = await eventRepository.getEventById(eventId);

    if (!event) {
        throw new AppError(404, 'Event not found');
    }

    if (event.organizer_id !== organizerId) {
        throw new AppError(
            403,
            'You do not have permission to delete this event',
        );
    }

    const ticketsSold = await eventRepository.getConfirmedTicketsCount(eventId);

    if (ticketsSold > 0) {
        throw new AppError(
            400,
            'Event has confirmed bookings and cannot be deleted',
        );
    }

    const deletedEvent = await eventRepository.deleteEvent(
        eventId,
        organizerId,
    );

    if (deletedEvent) {
        return deletedEvent;
    }

    const currentEvent = await eventRepository.getEventById(eventId);

    if (!currentEvent) {
        throw new AppError(404, 'Event not found');
    }

    if (currentEvent.organizer_id !== organizerId) {
        throw new AppError(
            403,
            'You do not have permission to delete this event',
        );
    }

    const currentTicketsSold =
        await eventRepository.getConfirmedTicketsCount(eventId);

    if (currentTicketsSold > 0) {
        throw new AppError(
            400,
            'Event has confirmed bookings and cannot be deleted',
        );
    }

    throw new AppError(500, 'Failed to delete event');
};

export const eventService = {
    createEvent,
    getAllEvents,
    getSingleEvent,
    updateEvent,
    deleteEvent,
};
