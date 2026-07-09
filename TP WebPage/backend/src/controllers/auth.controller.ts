import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export function loginHandler(req: Request, res: Response): void {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  const result = authService.login(email, password);
  if (!result) {
    res.status(401).json({ message: 'Invalid credentials.' });
    return;
  }

  res.json(result);
}

export function acceptInviteHandler(req: Request, res: Response): void {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  const result = authService.acceptInvite(email, password);
  if (!result) {
    res.status(404).json({ message: 'Invite not found.' });
    return;
  }

  res.json(result);
}

export function forgotPasswordHandler(req: Request, res: Response): void {
  const { email, newPassword } = req.body ?? {};

  if (typeof email !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ message: 'Email and new password are required.' });
    return;
  }

  const result = authService.resetPassword(email, newPassword);
  if (!result) {
    res.status(404).json({ message: 'No active account found for that email.' });
    return;
  }

  res.json({ success: true });
}

export function createInviteHandler(req: Request, res: Response): void {
  const { email } = req.body ?? {};

  if (typeof email !== 'string') {
    res.status(400).json({ message: 'Email is required.' });
    return;
  }

  const result = authService.createInvite(email);
  if (!result) {
    res.status(409).json({ message: 'That email belongs to a non-trainee account.' });
    return;
  }

  res.json(result);
}
