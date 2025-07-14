import { test, expect } from '@playwright/test';

test.describe('OpenBias E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Perform login
    await page.getByPlaceholder('Email').fill('test@example.com');
    await page.getByPlaceholder('Password').fill('password');
    await page.getByRole('button', { name: 'Login' }).click();
    // Wait for navigation to the dashboard
    await page.waitForURL('**/dashboard');
  });

  test('should view the story feed after login', async ({ page }) => {
    // Check if the main components of the dashboard are visible
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible(); // Sidebar
    await expect(page.locator('main')).toBeVisible(); // Main content with story feed

    // Check for story feed
    await expect(page.getByText('Story Feed')).toBeVisible();

    // Wait for stories to load.
    await page.waitForSelector('article');

    const stories = await page.locator('article').count();
    expect(stories).toBeGreaterThan(0);
  });

  test('should open story detail modal and view bias analysis', async ({ page }) => {
    // Wait for stories to be loaded
    await page.waitForSelector('article');

    // Click on the first story
    await page.locator('article').first().click();

    // Check if the modal is visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Check for elements within the modal
    await expect(page.locator('.modal-title')).toBeVisible();
    await expect(page.getByText('Bias Analysis')).toBeVisible();
    await expect(page.getByText('Left')).toBeVisible();
    await expect(page.getByText('Center')).toBeVisible();
    await expect(page.getByText('Right')).toBeVisible();

    // Check for articles within the modal
    const articlesInModal = await page.locator('.modal-body article').count();
    expect(articlesInModal).toBeGreaterThan(0);

    // Close the modal
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should show bias chips on stories in the feed', async ({ page }) => {
    await page.waitForSelector('article');

    // Find the first story and check for bias chips
    const firstStory = page.locator('article').first();
    const biasChip = firstStory.locator('div.bias-chip');

    await expect(biasChip.first()).toBeVisible();
    const chipText = await biasChip.first().textContent();
    expect(chipText).not.toBeNull();
    if (chipText) {
        expect(['Left', 'Center', 'Right']).toContain(chipText.trim());
    }
  });
});
