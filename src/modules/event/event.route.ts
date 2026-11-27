import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../../types';
import { eventController } from './event.controller';

const router = Router();

router.post('/', auth(USER_ROLE.organizer), eventController.createEvent);
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getSingleEvent);
router.patch('/:id', auth(USER_ROLE.organizer), eventController.updateEvent);
router.delete('/:id', auth(USER_ROLE.organizer), eventController.deleteEvent);

export const eventRoute = router;
