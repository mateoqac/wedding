import type { EmailMessage, EmailSender } from "./email-sender";

/** In-memory sender for tests and local development. */
export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
