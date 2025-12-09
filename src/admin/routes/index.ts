import { Router } from 'express';
import authRoutes from './auth.routes';
import clientsRoutes from './clients.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientsRoutes);

export default router;
