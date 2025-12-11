import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
// Add authentication middleware if needed for V1 (e.g. check if request is from valid admin)
// For now, assuming Global Auth or internal usage.

const router = Router();

router.get('/', usersController.listUsers);
router.post('/', usersController.createUser);
router.delete('/:id', usersController.deleteUser);

export default router;
