import { Resend } from "resend";
import type { EmailMessage, EmailSender } from "./email-sender";

/** The slice of the Resend SDK this adapter uses; lets tests inject a fake client. */
export interface ResendEmailsClient {
  emails: {
    send(payload: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    }): Promise<{ error: { name: string; message: string } | null }>;
  };
}

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly client: ResendEmailsClient,
    private readonly from: string,
  ) {}

  static fromApiKey(apiKey: string, from: string) {
    return new ResendEmailSender(new Resend(apiKey), from);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    if (error) throw new Error(`Resend email failed: ${error.name}: ${error.message}`);
  }
}
