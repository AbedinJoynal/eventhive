import type { Request, Response } from 'express';
import { eventService } from './event.service';
import sendResponse from '../../utils/send-response';

const createEvent = async (req: Request, res: Response) => {
    const result = await eventService.createEvent(req.body, req.user!.id);

    sendResponse(res, {
        statusCode: 201,
        message: 'Event created successfully',
        data: result,
    });
};

const getAllEvents = async (req: Request, res: Response) => {
    const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await eventService.getAllEvents(search);

    sendResponse(res, {
        statusCode: 200,
        message: 'Events retrieved successfully',
        data: result,
    });
};

const getSingleEvent = async (req: Request, res: Response) => {
    const result = await eventService.getSingleEvent(req.params.id);

    sendResponse(res, {
        statusCode: 200,
        message: 'Event retrieved successfully',
        data: result,
    });
};

const updateEvent = async (req: Request, res: Response) => {
    const result = await eventService.updateEvent(
        req.params.id,
        req.body,
        req.user!.id,
        req.user!.role
    );

    sendResponse(res, {
        statusCode: 200,
        message: 'Event updated successfully',
        data: result,
    });
};

const deleteEvent = async (req: Request, res: Response) => {
    await eventService.deleteEvent(req.params.id, req.user!.id,req.user!.role);

    sendResponse(res, {
        statusCode: 200,
        message: 'Event deleted successfully',
        data: null,
    });
};

export const eventController = {
    createEvent,
    getAllEvents,
    getSingleEvent,
    updateEvent,
    deleteEvent,
};
