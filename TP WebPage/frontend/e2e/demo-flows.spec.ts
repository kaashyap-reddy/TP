import { expect, Page, test } from '@playwright/test';

// Demo-mode end-to-end coverage of the flows the audits verified by hand: per-role entry,
// the Training Plan automation surface, feedback-form attach + validation, per-trainee
// attendance, instruction files, and the 404 page. Runs with no backend and no database.

async function enterDemo(page: Page, role: 'Admin' | 'Facilitator' | 'Trainee'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: `View as ${role}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}$`));
  await expect(page.getByText('Demo Mode', { exact: false }).first()).toBeVisible();
}

// Everything past the Dashboard/Settings rows lives inside one of the sidebar's named
// dropdowns (Facilitator/Trainee use "Me"/"Global"; Admin has its own group names). The
// dropdown stays expanded after a child is selected, so only toggle it open if it isn't
// already -- clicking an already-open toggle collapses it instead.
async function openSidebarItem(page: Page, groupLabel: string, itemName: string): Promise<void> {
  const sidebar = page.getByRole('complementary');
  const groupButton = sidebar.getByRole('button', { name: groupLabel, exact: true });
  if ((await groupButton.getAttribute('aria-expanded')) !== 'true') {
    await groupButton.click();
  }
  await sidebar.getByRole('button', { name: itemName, exact: true }).click();
}

test('login page loads without console errors (backend down)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  // No /auth/refresh 500s, no favicon 404 — the console must be clean on a cold visit.
  expect(errors).toEqual([]);
});

test('each role can enter Demo Mode and lands on its portal', async ({ page }) => {
  await enterDemo(page, 'Admin');
  await page.goto('/');
  await enterDemo(page, 'Facilitator');
  await page.goto('/');
  await enterDemo(page, 'Trainee');
});

test('unknown routes render the 404 page, not a login redirect', async ({ page }) => {
  await page.goto('/trainee/discussions');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();

  // Signed in, the escape hatch points at the user's own dashboard instead.
  await enterDemo(page, 'Facilitator');
  await page.goto('/some/bogus/path');
  await expect(page.getByRole('link', { name: 'Go to my dashboard' })).toHaveAttribute('href', '/facilitator');
});

test('admin sees both training plans with full curricula', async ({ page }) => {
  await enterDemo(page, 'Admin');
  await openSidebarItem(page, 'Programs & Batches', 'Training Plans');
  await expect(page.getByRole('heading', { name: 'BA BTech' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'BA MBA' })).toBeVisible();
  await expect(page.getByText('42 sessions').first()).toBeVisible();
});

test('facilitator batch detail shows real per-trainee attendance percentages', async ({ page }) => {
  await enterDemo(page, 'Facilitator');
  await page.goto('/facilitator/batches/demo-batch-ba-btech');
  const attendanceCell = page.getByRole('cell', { name: /%/ }).first();
  await expect(attendanceCell).toBeVisible();
  await expect(attendanceCell).not.toHaveText('—');
});

test('assignment feedback form rejects an invalid URL and accepts a valid one', async ({ page }) => {
  await enterDemo(page, 'Facilitator');
  await page.goto('/assignments/demo-btech-assignment-1');
  await page.getByRole('button', { name: '+ Attach Feedback Form' }).click();

  const urlInput = page.getByPlaceholder('https://forms.gle/...');
  await urlInput.fill('not-a-valid-url');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/valid form URL/i)).toBeVisible();

  await urlInput.fill('https://forms.office.com/r/e2e-test');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Open Feedback Form').first()).toBeVisible();
});

test('assignment detail exposes the sample instructions file', async ({ page }) => {
  await enterDemo(page, 'Facilitator');
  await page.goto('/assignments/demo-btech-assignment-1');
  const fileButton = page.getByRole('button', { name: 'View Assignment File' });
  await expect(fileButton).toBeEnabled();
});

test('trainee sees own batch and assignments', async ({ page }) => {
  await enterDemo(page, 'Trainee');
  await openSidebarItem(page, 'Me', 'My Batch');
  await expect(page.getByText('BA BTech - July 2026').filter({ visible: true }).first()).toBeVisible();
  await openSidebarItem(page, 'Me', 'Assignments');
  await expect(page.getByText(/Case Study/).first()).toBeVisible();
});
