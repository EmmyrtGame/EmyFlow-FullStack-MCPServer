import { Router } from 'express';
import { clientsController } from '../controllers/clients.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, clientsController.getClients);

export default router;
