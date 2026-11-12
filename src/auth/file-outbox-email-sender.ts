import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EmailMessage, EmailSender } from "./email-sender";

/** Development sender (D10): writes each email as JSON to a directory instead of sending it. */
export class FileOutboxEmailSender implements EmailSender {
  private counter = 0;

  constructor(private readonly directory: string) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const name = `${Date.now()}-${process.pid}-${this.counter++}.json`;
    await writeFile(join(this.directory, name), JSON.stringify(message, null, 2));
    console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}
