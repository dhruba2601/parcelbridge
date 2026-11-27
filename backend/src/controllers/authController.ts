import { Request, Response, NextFunction } from 'express';
import { repo, toSafeProfile } from '../db/repository';
import { loginUser, registerUser } from '../services/authService';

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginUser(req.body.email, req.body.password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export function logoutController(_req: Request, res: Response) {
  res.json({ message: 'Logged out successfully' });
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await repo.findProfileById(req.user!.sub);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ user: toSafeProfile(profile) });
  } catch (err) {
    next(err);
  }
}

export async function updateMeController(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body.societyId !== undefined && req.user!.role !== 'super_admin') {
      res.status(403).json({
        error: 'Only administrators may reassign residential society membership',
        code: 'FORBIDDEN_TENANT_CHANGE',
      });
      return;
    }

    const updated = await repo.updateProfile(req.user!.sub, {
      ...(req.body.fullName !== undefined ? { full_name: req.body.fullName } : {}),
      ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
      ...(req.body.societyId !== undefined ? { society_id: req.body.societyId } : {}),
      ...(req.body.flatNumber !== undefined ? { flat_number: req.body.flatNumber } : {}),
    });
    res.json({ user: toSafeProfile(updated) });
  } catch (err) {
    next(err);
  }
}
