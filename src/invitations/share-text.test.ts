import { describe, expect, it } from "vitest";
import { fixtures } from "@/templates/clasico-marco-doble/v1/fixtures";
import { buildShareText } from "./share-text";

describe("share text (alt text for shared images)", () => {
  it("describes the full invitation in plain Spanish", () => {
    expect(buildShareText(fixtures.typical)).toBe(
      [
        "Parte de matrimonio de Álvaro Galán Piazzano y Francisca Carmona Redard.",
        "Sus padres, Osvaldo Carmona Morales y Marcela Redard Ayala, y Álvaro Galán Díaz y Paula Piazzano Zamorano, tienen el agrado de invitarle.",
        "Ceremonia religiosa que se efectuará con misa de precepto en la Capilla del Colegio Cumbres: sábado 13 de marzo de 2027 a las 16:45 horas, en Av. La Plaza 1150, Las Condes.",
        "Recepción: 22:00 horas en Centro de Eventos Arboleda Chicureo, Alba 1 / 11640, Chicureo, Colina.",
        "Confirmar asistencia: +56 9 8299 5134, +56 9 8134 7187 o familiagalancarmona@example.cl.",
        "Cómo llegar: https://waze.com/ul?q=Arboleda%20Chicureo",
        "Lista de regalos: Novios Falabella - Código 2104134 (https://www.falabella.com/novios).",
        "Santiago, enero 2027.",
      ].join("\n"),
    );
  });

  it("leaves out optional blocks that are empty", () => {
    const text = buildShareText(fixtures.minimal);
    expect(text).not.toContain("Recepción");
    expect(text).not.toContain("Cómo llegar");
    expect(text).not.toContain("Lista de regalos");
    expect(text).toContain("Confirmar asistencia: +56 9 1111 2222.");
    expect(text.startsWith("Parte de matrimonio de Ana Pérez y Luis Soto.")).toBe(true);
  });

  it("handles one parent per family and a gift label without link", () => {
    const text = buildShareText({ ...fixtures.minimal, giftRegistry: { label: "Cuenta RUT 12.345.678-9" } });
    expect(text).toContain("Sus padres, Juan Pérez, y Rosa Soto, tienen el agrado de invitarle.");
    expect(text).toContain("Lista de regalos: Cuenta RUT 12.345.678-9.");
  });
});
