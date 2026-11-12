import { expect, it } from "vitest";
import { formatClp } from "./money";

it("formats CLP with dot thousands separators", () => {
  expect(formatClp(9990)).toBe("$9.990");
  expect(formatClp(1250000)).toBe("$1.250.000");
  expect(formatClp(500)).toBe("$500");
});
