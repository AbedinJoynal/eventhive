import express, { type Application } from 'express';

import { authRoute } from './modules/auth/auth.route';
import { eventRoute } from './modules/event/event.route';
import { bookingRoute } from './modules/booking/booking.route';
import errorHandler from './middleware/errorhandler';


const app: Application = express();

app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRoute);
app.use('/api/v1/events', eventRoute);
app.use('/api/v1/bookings', bookingRoute);

app.use(errorHandler);

export default app;
