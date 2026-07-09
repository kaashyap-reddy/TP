import { Router } from 'express';
import {
  acceptInviteHandler,
  createInviteHandler,
  forgotPasswordHandler,
  loginHandler
} from '../controllers/auth.controller';

const router = Router();

router.post('/login', loginHandler);
router.post('/invite/accept', acceptInviteHandler);
router.post('/invite', createInviteHandler);
router.post('/forgot-password', forgotPasswordHandler);

export default router;
