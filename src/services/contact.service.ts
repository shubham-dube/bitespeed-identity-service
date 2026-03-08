import { Contact, LinkPrecedence } from '@prisma/client';
import { contactRepository, ContactRepository } from '../repositories/contact.repository';
import {
  IdentifyRequestBody,
  ConsolidatedContact,
} from '../types/contact.types';
import logger from '../utils/logger';

/**
 * ContactService — The heart of the application.
 *
 * Implements the full identity reconciliation algorithm:
 *
 *  1. Validate at least one of email / phone is present.
 *  2. Query DB for any contacts matching email OR phone.
 *  3. No matches → create new primary contact.
 *  4. Matches found → expand to full cluster(s).
 *  5. Multiple primaries → merge: older stays primary, newer is demoted.
 *  6. Request contains new info not in cluster → create secondary contact.
 *  7. Build & return consolidated contact response.
 */
export class ContactService {
  constructor(private readonly repo: ContactRepository) {}

  async identify(body: IdentifyRequestBody): Promise<ConsolidatedContact> {
    const { email, phoneNumber } = body;

    // ── STEP 1: Find all directly matching contacts ───────────────────────────
    const directMatches = await this.repo.findByEmailOrPhone(email, phoneNumber);

    // ── STEP 2: No existing contacts — create a new primary ──────────────────
    if (directMatches.length === 0) {
      logger.info('No matching contacts found — creating new primary contact');
      const newContact = await this.repo.create({
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.primary,
      });
      return this.buildResponse(newContact, []);
    }

    // ── STEP 3: Resolve every matched contact to its root primary ID ─────────
    // A contact can be:
    //   (a) primary   → its own ID is the root
    //   (b) secondary → its linkedId is the root primary ID
    const primaryIds = new Set<number>();

    for (const contact of directMatches) {
      if (contact.linkPrecedence === LinkPrecedence.primary) {
        primaryIds.add(contact.id);
      } else if (contact.linkedId !== null) {
        primaryIds.add(contact.linkedId);
      }
    }

    // ── STEP 4: Fetch actual primary Contact rows (only linkPrecedence=primary)
    // Guarding against a race where linkedId points to a row already demoted.
    const primaries = await this.repo.findPrimaryContactsByIds(Array.from(primaryIds));

    if (primaries.length === 0) {
      logger.warn('Could not resolve any primary contacts — creating new primary');
      const newContact = await this.repo.create({
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.primary,
      });
      return this.buildResponse(newContact, []);
    }

    // ── STEP 5: Merge if multiple primaries ──────────────────────────────────
    // Sort oldest first → oldest wins and stays primary
    primaries.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const [truePrimary, ...toBeDemoted] = primaries;

    if (toBeDemoted.length > 0) {
      logger.info(
        `Merging clusters: keeping primary ${truePrimary.id}, demoting [${toBeDemoted.map((p) => p.id).join(', ')}]`,
      );
      // Demote sequentially to avoid FK constraint conflicts in chained clusters
      for (const contact of toBeDemoted) {
        await this.repo.demoteToPrimary(contact.id, truePrimary.id);
      }
    }

    // ── STEP 6: Fetch the complete up-to-date cluster ────────────────────────
    const fullCluster = await this.repo.findClusterByPrimaryId(truePrimary.id);
    const clusterEmails = this.extractUnique(fullCluster, 'email');
    const clusterPhones = this.extractUnique(fullCluster, 'phoneNumber');

    // ── STEP 7: Check if the request brings new information ───────────────────
    const isNewEmail = !!email && !clusterEmails.includes(email);
    const isNewPhone = !!phoneNumber && !clusterPhones.includes(phoneNumber);

    if (isNewEmail || isNewPhone) {
      logger.info('New information detected — creating secondary contact');
      await this.repo.create({
        email: email ?? null,
        phoneNumber: phoneNumber ?? null,
        linkedId: truePrimary.id,
        linkPrecedence: LinkPrecedence.secondary,
      });
    }

    // ── STEP 8: Re-fetch final cluster and build response ────────────────────
    const finalCluster = await this.repo.findClusterByPrimaryId(truePrimary.id);
    const secondaries = finalCluster.filter((c) => c.id !== truePrimary.id);

    return this.buildResponse(truePrimary, secondaries);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private extractUnique(cluster: Contact[], field: 'email' | 'phoneNumber'): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const contact of cluster) {
      const value = contact[field];
      if (value && !seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
    return result;
  }

  private buildResponse(primary: Contact, secondaries: Contact[]): ConsolidatedContact {
    const allContacts = [primary, ...secondaries];
    return {
      primaryContatctId: primary.id,
      emails: this.extractUnique(allContacts, 'email'),
      phoneNumbers: this.extractUnique(allContacts, 'phoneNumber'),
      secondaryContactIds: secondaries.map((c) => c.id),
    };
  }
}

export const contactService = new ContactService(contactRepository);