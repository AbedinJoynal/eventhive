import type { Request, Response } from 'express';
import { eventService } from './event.service';

const createEvent = async (req: Request, res: Response) => {
    const result = await eventService.createEvent(req.body, req.user!.id);

    res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: result,
    });
};

const getAllEvents = async (req: Request, res: Response) => {
    const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await eventService.getAllEvents(search);

    res.status(200).json({
        success: true,
        message: 'Events retrieved successfully',
        data: result,
    });
};

const getSingleEvent = async (req: Request, res: Response) => {
    const result = await eventService.getSingleEvent(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Event retrieved successfully',
        data: result,
    });
};

const updateEvent = async (req: Request, res: Response) => {
    const result = await eventService.updateEvent(
        req.params.id,
        req.body,
        req.user!.id,
    );

    res.status(200).json({
        success: true,
        message: 'Event updated successfully',
        data: result,
    });
};

const deleteEvent = async (req: Request, res: Response) => {
    await eventService.deleteEvent(req.params.id, req.user!.id);

    res.status(200).json({
        success: true,
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
