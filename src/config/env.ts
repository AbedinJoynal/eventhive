import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env'),
});

const port = process.env.PORT;

const config = {
    port,
};

export default config;
