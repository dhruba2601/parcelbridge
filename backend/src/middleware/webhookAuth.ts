import { Request, Response, NextFunction } from 'express';
import { verifyWebhookSignature } from '../utils/crypto';

export function verifyPartnerWebhook(req: Request, res: Response, next: NextFunction): void {
  const timestamp = req.header('X-ParcelBridge-Timestamp');
  const signature = req.header('X-ParcelBridge-Signature');

  if (!timestamp || !signature) {
    res.status(401).json({
      error: 'Missing webhook authentication headers (X-ParcelBridge-Timestamp, X-ParcelBridge-Signature)',
      code: 'WEBHOOK_AUTH_MISSING',
    });
    return;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
  if (!verifyWebhookSignature(timestamp, rawBody, signature)) {
    res.status(401).json({
      error: 'Invalid or expired webhook signature',
      code: 'WEBHOOK_SIGNATURE_INVALID',
    });
    return;
  }

  next();
}
