import { Router } from 'express';
import { apiKeyController } from './controller';
import { authenticate } from '../../shared/middleware/auth';

const router = Router();

router.post('/generate', authenticate, apiKeyController.generateKey);
router.get('/info', authenticate, apiKeyController.getKeyInfo);
router.post('/regenerate', authenticate, apiKeyController.regenerateKey);
router.delete('/', authenticate, apiKeyController.revokeKey);
router.put('/webhook', authenticate, apiKeyController.configureWebhook);
router.get('/webhook', authenticate, apiKeyController.getWebhookConfig);

export default router;
