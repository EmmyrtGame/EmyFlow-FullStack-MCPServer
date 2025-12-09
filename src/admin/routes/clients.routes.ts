import { Router } from 'express';
import multer from 'multer';
import { clientsController } from '../controllers/clients.controller';
import { serviceAccountController } from '../controllers/service-account.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.get('/', authenticateToken, clientsController.getClients);
router.get('/:id', authenticateToken, clientsController.getClient);
router.post('/', authenticateToken, clientsController.createClient);
router.put('/:id', authenticateToken, clientsController.updateClient);
router.delete('/:id', authenticateToken, clientsController.deleteClient);

router.post('/:id/service-account', authenticateToken, upload.single('file'), serviceAccountController.uploadServiceAccount);

export default router;
