import Database from "better-sqlite3";
import {
  ShapeStream,
  type Message,
  isChangeMessage,
  isControlMessage,
  Offset,
} from "@electric-sql/client";

// Type for our items table
type ItemRow = {
  id: number;
  name: string;
  description: string | null;
};

interface PreparedStatements {
  insert: Database.Statement;
  update: Database.Statement;
  delete: Database.Statement;
  saveOffset: Database.Statement;
  getOffset: Database.Statement;
}

class SyncManager {
  private db: Database.Database;
  private stream: ShapeStream<ItemRow>;
  private prepared: PreparedStatements;

  constructor() {
    // Initialize SQLite database
    this.db = new Database("local.db");
    this.initializeDatabase();

    // Prepare all our SQL statements
    this.prepared = {
      insert: this.db.prepare(
        "INSERT OR REPLACE INTO items (id, name, description) VALUES (?, ?, ?)"
      ),
      update: this.db.prepare(
        "UPDATE items SET name = ?, description = ? WHERE id = ?"
      ),
      delete: this.db.prepare("DELETE FROM items WHERE id = ?"),
      saveOffset: this.db.prepare(
        "INSERT OR REPLACE INTO sync_state (table_name, last_offset) VALUES (?, ?)"
      ),
      getOffset: this.db.prepare(
        "SELECT last_offset FROM sync_state WHERE table_name = ?"
      ),
    };

    // Initialize ElectricSQL stream
    this.stream = new ShapeStream({
      url: "http://localhost:3333/v1/shape",
      params: {
        table: "items",
        replica: "full", // Get full rows on updates
      },
      // Start from last known offset
      offset: this.getLastOffset(),
    });
  }

  private initializeDatabase() {
    // Create items table matching Postgres schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
    `);

    // Create offset tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        table_name TEXT PRIMARY KEY,
        last_offset TEXT NOT NULL
      );
    `);
  }

  private getLastOffset(): Offset | undefined {
    const result = this.prepared.getOffset?.get("items") as
      | { last_offset: string }
      | undefined;
    return result?.last_offset as Offset | undefined;
  }

  private saveOffset() {
    const offset = this.stream.lastOffset;
    this.prepared.saveOffset?.run("items", offset);
  }

  private handleMessages(
    messages: Message<ItemRow>[],
    transaction: (statements: [Database.Statement, any[]][]) => void,
    currentBatch: [Database.Statement, any[]][]
  ): [Database.Statement, any[]][] {
    for (const msg of messages) {
      if (isChangeMessage<ItemRow>(msg)) {
        const { headers, value } = msg;

        switch (headers.operation) {
          case "insert":
            currentBatch.push([
              this.prepared.insert!,
              [value.id, value.name, value.description],
            ]);
            break;
          case "update":
            currentBatch.push([
              this.prepared.update!,
              [value.name, value.description, value.id],
            ]);
            break;
          case "delete":
            currentBatch.push([this.prepared.delete!, [value.id]]);
            break;
        }
        this.saveOffset();
      } else if (isControlMessage(msg)) {
        if (msg.headers.control === "up-to-date") {
          // Execute current batch in transaction and clear it
          if (currentBatch.length > 0) {
            transaction(currentBatch);
            currentBatch = [];
          }
          console.log("Sync is up to date!");
        }
      }
    }
    return currentBatch;
  }

  async start() {
    console.log("Starting sync manager...");

    // Create a transaction function that we'll use to wrap our operations
    let transaction = this.db.transaction(
      (statements: [Database.Statement, any[]][]) => {
        for (const [stmt, params] of statements) {
          stmt.run(...params);
        }
      }
    );

    let currentBatch: [Database.Statement, any[]][] = [];

    this.stream.subscribe(
      (messages) => {
        currentBatch = this.handleMessages(messages, transaction, currentBatch);
      },
      (error: Error) => {
        console.error("Error in sync:", error);
        // Clear the batch on error
        currentBatch = [];
      }
    );

    console.log("Sync manager is running...");
  }

  close() {
    this.stream.unsubscribeAll();
    this.db.close();
  }
}

// Start the sync manager
const syncManager = new SyncManager();
await syncManager.start();

// Handle shutdown gracefully
process.on("SIGINT", () => {
  console.log("Shutting down...");
  syncManager.close();
  process.exit(0);
});
