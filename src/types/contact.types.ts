import { Contact, LinkPrecedence } from '@prisma/client';

// Re-export Prisma's generated type so the rest of the app
// imports from one place and isn't coupled to Prisma directly.
export type { Contact, LinkPrecedence };

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface IdentifyRequestBody {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface ConsolidatedContact {
  primaryContatctId: number; 
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: ConsolidatedContact;
}

// ─── Repository-layer types ───────────────────────────────────────────────────

export interface CreateContactInput {
  email?: string | null;
  phoneNumber?: string | null;
  linkedId?: number | null;
  linkPrecedence: LinkPrecedence;
}

export interface ContactCluster {
  primary: Contact;
  secondaries: Contact[];
}