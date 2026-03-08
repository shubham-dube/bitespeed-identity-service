import { Contact, LinkPrecedence } from '@prisma/client';
import prisma from '../config/database';
import { CreateContactInput } from '../types/contact.types';

export class ContactRepository {
  /**
   * Find all non-deleted contacts matching either email or phoneNumber.
   */
  async findByEmailOrPhone(
    email: string | null | undefined,
    phoneNumber: string | null | undefined,
  ): Promise<Contact[]> {
    const conditions: { email?: string; phoneNumber?: string }[] = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });
    if (conditions.length === 0) return [];

    return prisma.contact.findMany({
      where: { OR: conditions, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a single contact by ID (non-deleted).
   */
  async findById(id: number): Promise<Contact | null> {
    return prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Given a list of IDs, fetch ONLY the ones that are still primary.
   * This is the safe way to resolve primaries — it filters out any ID
   * that has since been demoted to secondary by a concurrent request.
   */
  async findPrimaryContactsByIds(ids: number[]): Promise<Contact[]> {
    if (ids.length === 0) return [];
    return prisma.contact.findMany({
      where: {
        id: { in: ids },
        linkPrecedence: LinkPrecedence.primary,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Fetch the primary + all its secondaries in one query.
   */
  async findClusterByPrimaryId(primaryId: number): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        OR: [{ id: primaryId }, { linkedId: primaryId }],
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Create a new contact row.
   */
  async create(data: CreateContactInput): Promise<Contact> {
    return prisma.contact.create({
      data: {
        email: data.email ?? null,
        phoneNumber: data.phoneNumber ?? null,
        linkedId: data.linkedId ?? null,
        linkPrecedence: data.linkPrecedence,
      },
    });
  }

  /**
   * Demote a primary to secondary and re-point all its children.
   * Runs inside a transaction for atomicity.
   */
  async demoteToPrimary(demotedId: number, newPrimaryId: number): Promise<void> {
    await prisma.$transaction([
      // Demote the contact itself
      prisma.contact.update({
        where: { id: demotedId },
        data: {
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: newPrimaryId,
          updatedAt: new Date(),
        },
      }),
      // Re-point all its existing secondaries to the new primary
      prisma.contact.updateMany({
        where: { linkedId: demotedId, deletedAt: null },
        data: { linkedId: newPrimaryId, updatedAt: new Date() },
      }),
    ]);
  }

  /**
   * Find all secondary contacts under a given primary ID.
   */
  async findSecondariesByPrimaryId(primaryId: number): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: { linkedId: primaryId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const contactRepository = new ContactRepository();