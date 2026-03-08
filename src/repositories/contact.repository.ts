import { Contact, LinkPrecedence } from '@prisma/client';
import prisma from '../config/database';
import { CreateContactInput } from '../types/contact.types';

/**
 * ContactRepository — The ONLY place in the codebase that talks to the DB.
 * No business logic here; just clean, reusable query methods.
 * This makes the service layer easy to unit-test (mock this class).
 */
export class ContactRepository {
  /**
   * Find all non-deleted contacts that match either the given email
   * or phoneNumber. Only non-null values are used as filter conditions.
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
      where: {
        OR: conditions,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a single contact by its primary key.
   */
  async findById(id: number): Promise<Contact | null> {
    return prisma.contact.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Fetch the primary contact and all its secondaries in one query.
   * Returns the full cluster for a given primary ID.
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
   * Demote a primary contact to secondary (when two clusters merge).
   * Points it at the winning primary and updates linkPrecedence.
   * Uses a transaction to atomically reassign all of its children too.
   */
  async demoteToPrimary(
    demotedId: number,
    newPrimaryId: number,
  ): Promise<void> {
    await prisma.$transaction([
      // Step 1: Demote the contact itself
      prisma.contact.update({
        where: { id: demotedId },
        data: {
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: newPrimaryId,
          updatedAt: new Date(),
        },
      }),
      // Step 2: Re-point all its existing secondaries to the new primary
      prisma.contact.updateMany({
        where: {
          linkedId: demotedId,
          deletedAt: null,
        },
        data: {
          linkedId: newPrimaryId,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * Find all contacts that are secondaries of a given primary ID.
   */
  async findSecondariesByPrimaryId(primaryId: number): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: {
        linkedId: primaryId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

// Export a singleton instance
export const contactRepository = new ContactRepository();