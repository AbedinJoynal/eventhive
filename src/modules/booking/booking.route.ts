import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../../types';
import { bookingController } from './booking.controller';

const router = Router();

router.post(
    '/',
    auth(USER_ROLE.attendee, USER_ROLE.organizer),
    bookingController.bookEventTickets,
);
router.get(
    '/',
    auth(USER_ROLE.attendee, USER_ROLE.organizer),
    bookingController.getUserBookings,
);
router.patch(
    '/:id/cancel',
    auth(USER_ROLE.attendee, USER_ROLE.organizer),
    bookingController.cancelBooking,
);

export const bookingRoute = router;
