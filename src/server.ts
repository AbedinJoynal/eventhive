import app from './app';
import config from './config/env';
import { authRepository } from './modules/auth/auth.repository';
import { eventRepository } from './modules/event/event.repository';
import { bookingRepository } from './modules/booking/booking.repository';

const main = async () => {
    try {
        await authRepository.initializeUsersTable();
        await eventRepository.initializeEventsTable();
        await bookingRepository.initializeBookingsTable();
        console.log('Database Connected !!!');

        app.listen(config.port, () => {
            console.log('Server is running on port:', config.port);
        });
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
};

main();
