import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import app from './app';
import { env } from './config/env';

const PORT = env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`📋 Environment: ${env.NODE_ENV}`);
});
