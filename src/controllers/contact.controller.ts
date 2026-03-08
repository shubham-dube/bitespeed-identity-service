import { Request, Response } from 'express';
import { contactService } from '../services/contact.service';
import { IdentifyRequestBody } from '../types/contact.types';
import logger from '../utils/logger';

/**
 * ContactController — Pure HTTP layer.
 * Reads the validated request body, delegates to the service,
 * and formats the HTTP response. Zero business logic here.
 */
export class ContactController {
  async identify(req: Request, res: Response): Promise<void> {
    const body = req.body as IdentifyRequestBody;

    logger.info(`POST /identify — email: ${body.email ?? 'null'}, phone: ${body.phoneNumber ?? 'null'}`);

    const result = await contactService.identify(body);

    res.status(200).json({ contact: result });
  }
}

export const contactController = new ContactController();