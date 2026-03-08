import { Router, Request, Response } from 'express';
import contactRoutes from './contact.routes';

const router = Router();

// Health check — used by load balancers / render.com keep-alive
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Feature routes
router.use('/', contactRoutes);

export default router;