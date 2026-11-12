import { describe, expect, it } from "vitest";
import { ResendEmailSender, type ResendEmailsClient } from "./resend-email-sender";

function fakeClient(response: Awaited<ReturnType<ResendEmailsClient["emails"]["send"]>>) {
  const calls: unknown[] = [];
  const client: ResendEmailsClient = {
    emails: {
      send: async (payload) => {
        calls.push(payload);
        return response;
      },
    },
  };
  return { client, calls };
}

describe("ResendEmailSender", () => {
  it("sends the message from the configured address", async () => {
    const { client, calls } = fakeClient({ error: null });
    const sender = new ResendEmailSender(client, "Partes <hola@partes.example>");

    await sender.send({ to: "ana@example.cl", subject: "Hola", text: "Texto" });

    expect(calls).toEqual([
      { from: "Partes <hola@partes.example>", to: "ana@example.cl", subject: "Hola", text: "Texto" },
    ]);
  });

  it("throws when Resend reports an error", async () => {
    const { client } = fakeClient({
      error: { message: "Invalid `to` field", name: "validation_error" },
    });
    const sender = new ResendEmailSender(client, "hola@partes.example");

    await expect(sender.send({ to: "x", subject: "s", text: "t" })).rejects.toThrow(
      "Resend email failed: validation_error: Invalid `to` field",
    );
  });
});
