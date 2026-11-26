import { Router } from 'express';
import { bookingController } from './booking.controller';

const router = Router();

router.post('/', bookingController.bookEventTickets);
router.get('/', bookingController.getUserBookings);
router.patch('/:id/cancel', bookingController.cancelBooking);

export const bookingRoute = router;