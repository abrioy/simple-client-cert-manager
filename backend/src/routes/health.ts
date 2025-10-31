import { Router } from 'express';
import { checkHealth } from '../services/stepCaCli.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    const healthy = await checkHealth();
    res.json({ healthy });
  } catch (error) {
    next(error);
  }
});
