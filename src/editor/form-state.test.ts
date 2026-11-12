import { describe, expect, it } from "vitest";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { invitationDataSchema } from "@/templates/clasico-marco-doble/v1/schema";
import { fieldForIssue, toFormState, toTemplateData } from "./form-state";

describe("editor form state", () => {
  it("round-trips every fixture through the form", () => {
    for (const data of Object.values(fixtures)) {
      const back = toTemplateData(toFormState(data));
      expect(invitationDataSchema.parse(back)).toEqual(data);
    }
  });

  it("omits empty optional blocks and trims values", () => {
    const form = toFormState(fixtures.minimal);
    form.partnerOne = "  Ana Pérez ";
    const data = toTemplateData(form);
    expect(data.couple.partnerOne).toBe("Ana Pérez");
    expect(data).not.toHaveProperty("party");
    expect(data).not.toHaveProperty("giftRegistry");
    expect(data).not.toHaveProperty("venueMapUrl");
  });

  it("starts empty from a new draft", () => {
    expect(toFormState({}).partnerOne).toBe("");
  });

  it("maps schema issue paths to form fields", () => {
    expect(fieldForIssue("couple.partnerTwo")).toBe("partnerTwo");
    expect(fieldForIssue("rsvp.phones.1")).toBe("phones");
    expect(fieldForIssue("font")).toBe("options");
  });
});
