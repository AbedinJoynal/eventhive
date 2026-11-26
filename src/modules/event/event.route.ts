import { Router } from 'express';
import { eventController } from './event.controller';

const router = Router();

router.post('/', eventController.createEvent);
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getSingleEvent);
router.patch('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export const eventRoute = router;