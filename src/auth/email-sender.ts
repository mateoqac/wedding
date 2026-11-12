export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Port for transactional email (Resend in production, fake in tests). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
