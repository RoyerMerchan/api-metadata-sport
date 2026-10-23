import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('dos equipos simultáneos, invitación, cambio persistente y cierre independiente', async ({ page, browser }) => {
  test.setTimeout(90000);
  const suffix = randomUUID().slice(0, 8), password = 'Team_browser_12345';
  const emailA = `browser-a-${suffix}@test.local`, emailB = `browser-b-${suffix}@test.local`;
  const teamA = `Club A ${suffix}`, teamB = `Club B ${suffix}`, player = `Privado ${suffix}`;
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  async function register(target: Page, email: string, team: string, createAtRegistration = true) {
    await target.goto('/auth/register');
    await target.getByLabel('Tu nombre', { exact: true }).fill(`Entrenador ${team}`);
    if (createAtRegistration) await target.getByLabel('Nombre del equipo o club (opcional)', { exact: false }).fill(team);
    await target.getByLabel('Correo electrónico', { exact: false }).fill(email);
    await target.getByLabel('Contraseña', { exact: true }).fill(password);
    await target.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    if (!createAtRegistration) {
      await expect(target).toHaveURL('/welcome');
      await target.getByLabel('Nombre del equipo o club', { exact: true }).fill(team);
      await target.getByRole('button', { name: 'Crear espacio privado', exact: true }).click();
    }
    await expect(target.getByRole('combobox', { name: 'Organización activa' })).toHaveValue(/.+/);
    await expect(target.getByRole('heading', { name: 'Una mirada al rendimiento.' })).toBeVisible();
  }
  await register(page, emailA, teamA);
  await page.goto('/club');
  await page.getByRole('button', { name: 'Jugador', exact: true }).click();
  await page.getByLabel('Nombre completo').fill(player); await page.getByRole('combobox', { name: 'Posición', exact: true }).selectOption('MF');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('link', { name: player, exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Organización', exact: true }).click();
  await page.getByRole('button', { name: 'Invitar persona', exact: true }).click();
  await page.getByLabel('Correo de la persona invitada').fill(emailB);
  await page.getByRole('combobox', { name: 'Permisos en este club', exact: true }).selectOption('VIEWER');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const invitation = page.getByLabel('Código para compartir'); await expect(invitation).toBeVisible(); const code = await invitation.inputValue();
  const otherContext = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: page.viewportSize() });
  try {
    const other = await otherContext.newPage(); other.on('pageerror', e => errors.push(e.message));
    await register(other, emailB, teamB, false); await other.goto('/club');
    await expect(other.getByRole('heading', { name: teamB, exact: true })).toBeVisible();
    await expect(other.getByText('Aún no hay datos para esta selección.', { exact: true })).toBeVisible();
    await expect(other.getByRole('link', { name: player, exact: false })).toHaveCount(0);
    await expect(other.getByRole('combobox', { name: 'Organización activa' }).locator('option')).toHaveCount(1);
    await other.goto('/welcome'); await other.getByLabel('Código de invitación', { exact: true }).fill(code);
    await other.getByRole('button', { name: 'Aceptar invitación', exact: true }).click();
    await expect(other).toHaveURL('/'); await other.goto('/club');
    await expect(other.getByRole('link', { name: player, exact: false })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Jugador', exact: true })).toHaveCount(0);
    await other.getByRole('combobox', { name: 'Organización activa' }).selectOption({ label: teamB });
    await expect(other.getByRole('heading', { name: teamB, exact: true })).toBeVisible(); await other.reload();
    await expect(other.getByRole('heading', { name: teamB, exact: true })).toBeVisible();
    await expect(other.getByText('Aún no hay datos para esta selección.', { exact: true })).toBeVisible();
    await expect(other.getByRole('link', { name: player, exact: false })).toHaveCount(0);
    await page.reload(); await expect(page.getByRole('heading', { name: teamA, exact: true })).toBeVisible();
    await page.goto('/profile'); await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await expect(page).toHaveURL(/auth\/login/);
    // Reuse the same browser tab for account B: no workspace from account A may remain.
    await page.getByLabel('Correo electrónico').fill(emailB); await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar a FOOTLAB', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Una mirada al rendimiento.' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Organización activa' }).selectOption({ label: teamB }); await page.goto('/club');
    await expect(page.getByRole('heading', { name: teamB, exact: true })).toBeVisible();
    await expect(page.getByText('Aún no hay datos para esta selección.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: player, exact: false })).toHaveCount(0);
    await other.reload(); await expect(other.getByRole('heading', { name: teamB, exact: true })).toBeVisible();
    await expect(other.getByText('Aún no hay datos para esta selección.', { exact: true })).toBeVisible();
    await other.screenshot({ path: `../../docs/screenshots/team-workspace-${test.info().project.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  } finally { await otherContext.close(); }
});
