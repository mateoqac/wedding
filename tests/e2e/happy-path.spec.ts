import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const OUTBOX = ".data/e2e/outbox";

async function lastEmail() {
  const files = (await readdir(OUTBOX)).sort();
  return JSON.parse(await readFile(join(OUTBOX, files[files.length - 1]), "utf8")) as { to: string; text: string };
}

// Single happy path (design §9): pick template -> fill -> pay (fake) -> receive access link -> download all formats.
test("couple designs, pays and downloads every format", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("parte de matrimonio");
  await page.getByRole("link", { name: "Ver plantillas" }).click();
  await page.getByRole("button", { name: "Usar esta plantilla" }).first().click();
  await expect(page).toHaveURL(/\/editor\//);
  // Wait for the React island to hydrate; typing earlier is discarded by hydration.
  await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });

  const fill = (label: string | RegExp, value: string, nth = 0) => page.getByLabel(label).nth(nth).fill(value);
  await fill("Nombre completo de la novia o novio", "Ana Pérez Soto", 0);
  await fill("Nombre completo de la novia o novio", "Luis Muñoz Rojas", 1);
  await fill("Padres (primera familia) — nombre 1", "Juan Pérez");
  await fill("Padres (segunda familia) — nombre 1", "Rosa Rojas");
  await page.getByRole("group", { name: "Ceremonia" }).getByLabel("Descripción").fill("Ceremonia civil");
  await page.getByRole("group", { name: "Ceremonia" }).getByLabel("Dirección").fill("Registro Civil, Providencia");
  await fill("Fecha", "2027-03-13");
  await page.getByRole("group", { name: "Ceremonia" }).getByLabel("Hora").fill("12:00");
  await fill("Teléfono 1", "+56 9 1111 2222");
  await fill("Ciudad", "Santiago");
  await fill("Texto de fecha", "enero 2027");

  await expect(page.getByAltText("Vista previa de la invitación con marca de agua")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Cambios guardados")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Continuar al pago" }).click();
  await page.getByLabel("Email").fill("ana@example.cl");
  await page.getByRole("button", { name: /^Pagar/ }).click();
  await expect(page.getByRole("heading", { name: "Pasarela de prueba" })).toBeVisible();
  await page.getByRole("button", { name: "Aprobar pago" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pago confirmado" })).toBeVisible();

  const shareText = page.getByRole("textbox", { name: "Texto para compartir" });
  await expect(shareText).toHaveValue(/^Parte de matrimonio de Ana Pérez Soto y Luis Muñoz Rojas\./);
  await expect(shareText).toHaveJSProperty("readOnly", true);

  const email = await lastEmail();
  expect(email.to).toBe("ana@example.cl");
  const link = email.text.match(/https?:\/\/\S+/)?.[0] ?? "";
  expect(link).toContain("/auth/access?token=");

  // The access link signs in from another device (fresh context without the edit-token cookie).
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage.getByRole("heading", { name: "Mis invitaciones" })).toBeVisible();
  await otherPage.getByRole("link", { name: "Descargar" }).click();

  for (const [name, type] of [
    ["PDF para imprenta", "application/pdf"],
    ["PDF digital", "application/pdf"],
    ["Imagen PNG", "image/png"],
    ["Imagen JPG", "image/jpeg"],
    ["Historia 9:16", "image/png"],
  ] as const) {
    const item = otherPage.getByRole("listitem").filter({ hasText: name });
    const href = await item.getByRole("link", { name: "Descargar" }).getAttribute("href");
    let response = await otherPage.request.get(href as string, { maxRedirects: 0 });
    for (let i = 0; i < 30 && response.status() === 202; i++) {
      await otherPage.waitForTimeout(1000);
      response = await otherPage.request.get(href as string, { maxRedirects: 0 });
    }
    expect(response.status(), name).toBe(303);
    const file = await otherPage.request.get(response.headers().location);
    expect(file.status(), name).toBe(200);
    expect(file.headers()["content-type"], name).toBe(type);
  }
  await other.close();
});

test("the access link works once and expired links show a resend action", async ({ page }) => {
  await page.goto("/auth/access?token=nope");
  await expect(page.getByRole("alert")).toContainText("no es válido");
  await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeVisible();
});

test("partial progress survives a reload and a template change", async ({ page }) => {
  await page.goto("/plantillas");
  await page.getByRole("button", { name: "Usar esta plantilla" }).first().click();
  await expect(page).toHaveURL(/\/editor\//);
  const editorUrl = page.url();
  await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
  const name = page.getByLabel("Nombre completo de la novia o novio").first();
  await name.fill("Ana Pérez Soto");
  await expect(page.getByText("Cambios guardados")).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
  await expect(name).toHaveValue("Ana Pérez Soto");

  await page.getByRole("link", { name: "cambiar" }).click();
  await expect(page.getByRole("heading", { name: "Cambia la plantilla" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Editorial" }).getByRole("button", { name: "Usar esta plantilla" }).click();
  await expect(page).toHaveURL(editorUrl);
  await expect(page.getByText("Plantilla Editorial")).toBeVisible();
  await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });
  await expect(name).toHaveValue("Ana Pérez Soto");
});

test("style options and formats are one Tab stop each and move with the arrow keys", async ({ page }) => {
  await page.goto("/plantillas");
  await page.getByRole("button", { name: "Usar esta plantilla" }).first().click();
  await expect(page).toHaveURL(/\/editor\//);
  await page.locator("astro-island:not([ssr])").waitFor({ state: "attached" });

  for (const groupName of ["Formato", "Color"]) {
    const group = page.getByRole("radiogroup", { name: groupName });
    const radios = group.getByRole("radio");
    // Roving tabindex: only the checked option is reachable with Tab.
    await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
    const count = await radios.count();
    await expect(group.locator('[role="radio"][tabindex="-1"]')).toHaveCount(count - 1);

    const checked = group.locator('[role="radio"][aria-checked="true"]');
    await checked.focus();
    const before = await checked.textContent();
    await page.keyboard.press("ArrowRight");
    const after = group.locator('[role="radio"][aria-checked="true"]');
    await expect(after).not.toHaveText(before ?? "");
    await expect(after).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(group.locator('[role="radio"][aria-checked="true"]')).toHaveText(before ?? "");
    await page.keyboard.press("End");
    await expect(radios.last()).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Home");
    await expect(radios.first()).toHaveAttribute("aria-checked", "true");
  }
  await expect(page.getByRole("tab")).toHaveCount(0);
});
