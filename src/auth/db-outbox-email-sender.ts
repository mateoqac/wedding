import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { demoOutbox } from "@/db/schema";
import type { EmailMessage, EmailSender } from "./email-sender";

/** Demo deployments without an email provider: emails are stored to be shown on screen. */
export class DbOutboxEmailSender implements EmailSender {
  constructor(private readonly db: Database) {}

  async send(message: EmailMessage): Promise<void> {
    await this.db.insert(demoOutbox).values({ to: message.to, subject: message.subject, text: message.text });
  }
}

export async function latestDemoEmail(db: Database, to: string) {
  const [row] = await db.select().from(demoOutbox).where(eq(demoOutbox.to, to)).orderBy(desc(demoOutbox.createdAt)).limit(1);
  return row ?? null;
}
