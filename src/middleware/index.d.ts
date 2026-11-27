import type { JwtPayload } from 'jsonwebtoken';
import type { Role } from '../types';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload & {
                id: number;
                role: Role;
            };
        }
    }
}
