import { ContactService } from '../../src/services/contact.service';
import { ContactRepository } from '../../src/repositories/contact.repository';
import { Contact, LinkPrecedence } from '@prisma/client';

// ── Helper ────────────────────────────────────────────────────────────────────

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 1,
  email: 'test@example.com',
  phoneNumber: '123456',
  linkedId: null,
  linkPrecedence: LinkPrecedence.primary,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  deletedAt: null,
  ...overrides,
});

// ── Mock Repository ───────────────────────────────────────────────────────────

const mockRepo = {
  findByEmailOrPhone: jest.fn(),
  findById: jest.fn(),
  findPrimaryContactsByIds: jest.fn(),   // ← new method
  findClusterByPrimaryId: jest.fn(),
  create: jest.fn(),
  demoteToPrimary: jest.fn(),
  findSecondariesByPrimaryId: jest.fn(),
} as unknown as ContactRepository;

const service = new ContactService(mockRepo);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContactService.identify', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Scenario 1: Brand new contact ─────────────────────────────────────────
  describe('when no existing contacts match', () => {
    it('creates a new primary contact and returns it', async () => {
      const newContact = makeContact({ id: 1 });

      (mockRepo.findByEmailOrPhone as jest.Mock).mockResolvedValue([]);
      (mockRepo.create as jest.Mock).mockResolvedValue(newContact);

      const result = await service.identify({
        email: 'test@example.com',
        phoneNumber: '123456',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ linkPrecedence: LinkPrecedence.primary }),
      );
      expect(result.primaryContatctId).toBe(1);
      expect(result.secondaryContactIds).toEqual([]);
    });
  });

  // ── Scenario 2: Exact match — idempotent ──────────────────────────────────
  describe('when request exactly matches an existing primary contact', () => {
    it('returns the existing contact without creating a new one', async () => {
      const existing = makeContact({
        id: 1,
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      (mockRepo.findByEmailOrPhone as jest.Mock).mockResolvedValue([existing]);
      (mockRepo.findPrimaryContactsByIds as jest.Mock).mockResolvedValue([existing]);
      (mockRepo.findClusterByPrimaryId as jest.Mock).mockResolvedValue([existing]);

      const result = await service.identify({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(result.primaryContatctId).toBe(1);
      expect(result.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(result.phoneNumbers).toEqual(['123456']);
      expect(result.secondaryContactIds).toEqual([]);
    });
  });

  // ── Scenario 3: New info → secondary contact created ─────────────────────
  describe('when request has new information', () => {
    it('creates a secondary contact for the new info', async () => {
      const primary = makeContact({
        id: 1,
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });
      const secondary = makeContact({
        id: 23,
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.secondary,
      });

      (mockRepo.findByEmailOrPhone as jest.Mock).mockResolvedValue([primary]);
      (mockRepo.findPrimaryContactsByIds as jest.Mock).mockResolvedValue([primary]);
      // Before creating secondary: only primary; after: primary + secondary
      (mockRepo.findClusterByPrimaryId as jest.Mock)
        .mockResolvedValueOnce([primary])
        .mockResolvedValueOnce([primary, secondary]);
      (mockRepo.create as jest.Mock).mockResolvedValue(secondary);

      const result = await service.identify({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: 1,
        }),
      );
      expect(result.primaryContatctId).toBe(1);
      expect(result.emails).toContain('mcfly@hillvalley.edu');
      expect(result.secondaryContactIds).toContain(23);
    });
  });

  // ── Scenario 4: Two primaries merge ──────────────────────────────────────
  describe('when request links two separate primary contacts', () => {
    it('demotes the newer primary and merges under the older', async () => {
      const olderPrimary = makeContact({
        id: 11,
        email: 'george@hillvalley.edu',
        phoneNumber: '919191',
        createdAt: new Date('2023-04-11'),
      });
      const newerPrimary = makeContact({
        id: 27,
        email: 'biffsucks@hillvalley.edu',
        phoneNumber: '717171',
        createdAt: new Date('2023-04-21'),
      });
      const demoted = {
        ...newerPrimary,
        linkPrecedence: LinkPrecedence.secondary,
        linkedId: 11,
      };

      (mockRepo.findByEmailOrPhone as jest.Mock).mockResolvedValue([
        olderPrimary,
        newerPrimary,
      ]);
      // findPrimaryContactsByIds returns both (both are still primary at query time)
      (mockRepo.findPrimaryContactsByIds as jest.Mock).mockResolvedValue([
        olderPrimary,
        newerPrimary,
      ]);
      (mockRepo.demoteToPrimary as jest.Mock).mockResolvedValue(undefined);
      // First cluster fetch: just the older primary's cluster (before new info check)
      // Second cluster fetch: full merged cluster
      (mockRepo.findClusterByPrimaryId as jest.Mock)
        .mockResolvedValueOnce([olderPrimary])
        .mockResolvedValueOnce([olderPrimary, demoted]);

      const result = await service.identify({
        email: 'george@hillvalley.edu',
        phoneNumber: '717171',
      });

      expect(mockRepo.demoteToPrimary).toHaveBeenCalledWith(27, 11);
      expect(result.primaryContatctId).toBe(11);
      expect(result.secondaryContactIds).toContain(27);
    });
  });
});