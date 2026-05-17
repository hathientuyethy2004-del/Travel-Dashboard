import { MongoClient, type Db } from "mongodb";
import { logger } from "./logger";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env["MONGODB_URI"];
  const dbName = process.env["DB_NAME"] ?? "smart_travel_platform";

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  logger.info({ dbName }, "Connected to MongoDB");
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
