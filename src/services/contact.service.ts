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

    // ── STEP 2: Find all directly matching contacts ───────────────────────────
    const directMatches = await this.repo.findByEmailOrPhone(email, phoneNumber);

    // ── STEP 3: No existing contacts — create a new primary ──────────────────
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

    // ── STEP 4: Expand each matched contact to its full cluster ───────────────
    //    A matched contact may itself be secondary, so we resolve its primary.
    const allPrimaryIds = await this.resolvePrimaryIds(directMatches);

    // ── STEP 5: Merge clusters if there are multiple primaries ────────────────
    const truePrimary = await this.mergeClustersIfNeeded(allPrimaryIds);

    // ── STEP 6: Re-fetch the complete, up-to-date cluster ────────────────────
    const fullCluster = await this.repo.findClusterByPrimaryId(truePrimary.id);
    const clusterEmails = this.extractUnique(fullCluster, 'email');
    const clusterPhones = this.extractUnique(fullCluster, 'phoneNumber');

    // ── STEP 7: Check if the request brings new information ───────────────────
    const isNewEmail = email && !clusterEmails.includes(email);
    const isNewPhone = phoneNumber && !clusterPhones.includes(phoneNumber);

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

  /**
   * For each matched contact, resolve it to a primary contact ID.
   * If the contact is already primary, use its own ID.
   * If it's secondary, follow its linkedId to find the primary.
   * Returns a deduplicated array of primary IDs.
   */
  private async resolvePrimaryIds(contacts: Contact[]): Promise<number[]> {
    const primaryIds = new Set<number>();

    for (const contact of contacts) {
      if (contact.linkPrecedence === LinkPrecedence.primary) {
        primaryIds.add(contact.id);
      } else if (contact.linkedId !== null) {
        // It's secondary — its linkedId IS the primary
        primaryIds.add(contact.linkedId);
      }
    }

    return Array.from(primaryIds);
  }

  /**
   * When there are multiple primary contacts in the merged set,
   * we keep the OLDEST one as primary and demote the rest.
   * Returns the winning (oldest) primary Contact object.
   */
  private async mergeClustersIfNeeded(primaryIds: number[]): Promise<Contact> {
    if (primaryIds.length === 1) {
      // Fast path: only one primary, no merge needed
      const primary = await this.repo.findById(primaryIds[0]);
      if (!primary) {
        throw new Error(`Primary contact ${primaryIds[0]} not found`);
      }
      return primary;
    }

    // Fetch all primaries and sort by createdAt ascending (oldest first)
    const primaries = await Promise.all(primaryIds.map((id) => this.repo.findById(id)));

    const validPrimaries = primaries.filter((p): p is Contact => p !== null);

    validPrimaries.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const [truePrimary, ...toBedemoted] = validPrimaries;

    logger.info(
      `Merging clusters: keeping primary ${truePrimary.id}, demoting [${toBedemoted.map((p) => p.id).join(', ')}]`,
    );

    // Demote all non-winning primaries (and their secondaries) in parallel
    await Promise.all(
      toBedemoted.map((contact) => this.repo.demoteToPrimary(contact.id, truePrimary.id)),
    );

    return truePrimary;
  }

  /**
   * Extract unique non-null values for a given field from the cluster,
   * with the primary contact's value always first.
   */
  private extractUnique(
    cluster: Contact[],
    field: 'email' | 'phoneNumber',
  ): string[] {
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

  /**
   * Build the final API response object from the primary contact
   * and its list of secondary contacts.
   */
  private buildResponse(
    primary: Contact,
    secondaries: Contact[],
  ): ConsolidatedContact {
    const allContacts = [primary, ...secondaries];

    const emails = this.extractUnique(allContacts, 'email');
    const phoneNumbers = this.extractUnique(allContacts, 'phoneNumber');
    const secondaryContactIds = secondaries.map((c) => c.id);

    return {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    };
  }
}

// Export singleton with the real repository injected
export const contactService = new ContactService(contactRepository);