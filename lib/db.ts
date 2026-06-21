import { MongoClient, Db, Collection, ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Owner {
  _id?: ObjectId;
  telegram_id: number;
  username: string | null;
  created_at: Date;
}

export interface Question {
  _id?: ObjectId;
  owner_id: number;
  anon_chat_id: number;
  text: string;
  sender_username?: string | null;
  sender_first_name?: string;
  answered: boolean;
  created_at: Date;
  answered_at: Date | null;
}

export interface ReplySession {
  _id?: ObjectId;
  owner_id: number;
  pending_question_id: ObjectId;
  created_at: Date;
}

export interface PendingQuestion {
  _id?: ObjectId;
  anon_chat_id: number;
  target_owner_id: number;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Cached connection (standard Vercel + MongoDB pattern)
// ---------------------------------------------------------------------------

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "anonbot";

/**
 * Returns a cached MongoDB database connection.
 * On cold starts a new connection is created and indexes are ensured.
 * On warm starts the existing connection is reused.
 */
export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(DB_NAME);

  // Ensure indexes (idempotent — safe to call on every cold start)
  await Promise.all([
    db
      .collection<Owner>("owners")
      .createIndex({ telegram_id: 1 }, { unique: true }),

    db
      .collection<ReplySession>("reply_sessions")
      .createIndex({ owner_id: 1 }, { unique: true }),

    // TTL: auto-delete stale reply sessions after 10 minutes
    db
      .collection<ReplySession>("reply_sessions")
      .createIndex({ created_at: 1 }, { expireAfterSeconds: 600 }),

    // TTL: auto-delete pending question markers after 5 minutes
    db
      .collection<PendingQuestion>("pending_questions")
      .createIndex({ anon_chat_id: 1 }, { unique: true }),

    db
      .collection<PendingQuestion>("pending_questions")
      .createIndex({ created_at: 1 }, { expireAfterSeconds: 300 }),
  ]);

  cachedClient = client;
  cachedDb = db;

  return db;
}

// ---------------------------------------------------------------------------
// Collection accessors (convenience)
// ---------------------------------------------------------------------------

export async function getOwners(): Promise<Collection<Owner>> {
  const db = await getDb();
  return db.collection<Owner>("owners");
}

export async function getQuestions(): Promise<Collection<Question>> {
  const db = await getDb();
  return db.collection<Question>("questions");
}

export async function getReplySessions(): Promise<Collection<ReplySession>> {
  const db = await getDb();
  return db.collection<ReplySession>("reply_sessions");
}

export async function getPendingQuestions(): Promise<
  Collection<PendingQuestion>
> {
  const db = await getDb();
  return db.collection<PendingQuestion>("pending_questions");
}
