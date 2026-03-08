import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.contact.deleteMany();
});

describe('POST /api/v1/identify', () => {

  // ── Validation ─────────────────────────────────────────────────────────────
  describe('Input Validation', () => {
    it('returns 400 when both email and phoneNumber are missing', async () => {
      const res = await request(app).post('/api/v1/identify').send({});
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('returns 400 when both email and phoneNumber are null', async () => {
      const res = await request(app)
        .post('/api/v1/identify')
        .send({ email: null, phoneNumber: null });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/identify')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('accepts request with only email', async () => {
      const res = await request(app)
        .post('/api/v1/identify')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
    });

    it('accepts request with only phoneNumber', async () => {
      const res = await request(app)
        .post('/api/v1/identify')
        .send({ phoneNumber: '999999' });
      expect(res.status).toBe(200);
    });
  });

  // ── New contact ────────────────────────────────────────────────────────────
  describe('New Contact Creation', () => {
    it('creates a new primary contact when no matches exist', async () => {
      const res = await request(app)
        .post('/api/v1/identify')
        .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.contact.primaryContatctId).toBeDefined();
      expect(res.body.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(res.body.contact.phoneNumbers).toContain('123456');
      expect(res.body.contact.secondaryContactIds).toEqual([]);
    });
  });

  // ── Secondary contact creation ─────────────────────────────────────────────
  describe('Secondary Contact Creation', () => {
    it('creates a secondary contact when new info matches an existing contact', async () => {
      await request(app)
        .post('/api/v1/identify')
        .send({ email: 'lorraine@hillvalley.edu', phoneNumber: '123456' });

      const res = await request(app)
        .post('/api/v1/identify')
        .send({ email: 'mcfly@hillvalley.edu', phoneNumber: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(res.body.contact.emails).toContain('mcfly@hillvalley.edu');
      // Primary email must come first
      expect(res.body.contact.emails[0]).toBe('lorraine@hillvalley.edu');
      expect(res.body.contact.secondaryContactIds).toHaveLength(1);
    });

    it('is idempotent — same request twice does not duplicate contacts', async () => {
      const payload = { email: 'lorraine@hillvalley.edu', phoneNumber: '123456' };
      await request(app).post('/api/v1/identify').send(payload);
      const res = await request(app).post('/api/v1/identify').send(payload);

      expect(res.status).toBe(200);
      expect(res.body.contact.emails).toHaveLength(1);
      expect(res.body.contact.secondaryContactIds).toHaveLength(0);
    });
  });

  // ── Cluster merging ────────────────────────────────────────────────────────
  // Timeout extended: 3 sequential HTTP calls + DB ops on a real DB
  describe('Cluster Merging (primary → secondary demotion)', () => {
    it(
      'merges two separate primaries when a bridging request arrives',
      async () => {
        // Create first primary
        await request(app)
          .post('/api/v1/identify')
          .send({ email: 'george@hillvalley.edu', phoneNumber: '919191' });

        // Create second primary (no overlap)
        await request(app)
          .post('/api/v1/identify')
          .send({ email: 'biffsucks@hillvalley.edu', phoneNumber: '717171' });

        // Bridging request links both clusters
        const res = await request(app)
          .post('/api/v1/identify')
          .send({ email: 'george@hillvalley.edu', phoneNumber: '717171' });

        expect(res.status).toBe(200);
        expect(res.body.contact.emails).toContain('george@hillvalley.edu');
        expect(res.body.contact.emails).toContain('biffsucks@hillvalley.edu');
        expect(res.body.contact.phoneNumbers).toContain('919191');
        expect(res.body.contact.phoneNumbers).toContain('717171');
        // The older primary's email must be first
        expect(res.body.contact.emails[0]).toBe('george@hillvalley.edu');
        expect(res.body.contact.secondaryContactIds.length).toBeGreaterThanOrEqual(1);

        // Verify DB state: only one primary should exist
        const primaries = await prisma.contact.findMany({
          where: { linkPrecedence: 'primary', deletedAt: null },
        });
        expect(primaries).toHaveLength(1);
      },
      15000, // ← explicit 15s timeout for this test
    );
  });

  // ── Health check ───────────────────────────────────────────────────────────
  describe('Health Check', () => {
    it('GET /api/v1/health returns 200', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});