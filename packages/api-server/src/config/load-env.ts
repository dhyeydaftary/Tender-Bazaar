import dotenv from 'dotenv';
import path from 'path';

// Load root .env before any modules are evaluated
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();
