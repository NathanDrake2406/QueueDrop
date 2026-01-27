import { test, expect } from "@playwright/test";

/**
 * E2E tests for the customer queue journey.
 * Tests the full flow from joining a queue to being called.
 */

test.describe("Customer Queue Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("should display home page with demo queue link", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "QueueDrop" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Try Demo Queue" })).toBeVisible();
  });

  test("should navigate to join queue page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Try Demo Queue" }).click();

    // With multi-queue, first see queue selector
    await expect(page).toHaveURL("/join/demo-shop");
    await expect(page.getByRole("heading", { name: "Choose a queue" })).toBeVisible();

    // Click on Main Queue
    await page.getByRole("button", { name: /Main Queue/i }).click();

    // Now should see join form
    await expect(page).toHaveURL("/join/demo-shop/main-queue");
    await expect(page.getByRole("heading", { name: "Join the Queue" })).toBeVisible();
    await expect(page.getByLabel("Your Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join Queue" })).toBeVisible();
  });

  test("should join queue and see position", async ({ page }) => {
    await page.goto("/join/demo-shop/main-queue");

    // Fill in name and submit
    await page.getByLabel("Your Name").fill("Alice Test");
    await page.getByRole("button", { name: "Join Queue" }).click();

    // Should redirect to position page
    await expect(page).toHaveURL(/\/q\/.+/);

    // Should show position card
    await expect(page.getByText("Your position")).toBeVisible();
    // Verify queue name is displayed (use getByRole to be more specific)
    await expect(page.getByRole("heading", { name: "Demo Shop" })).toBeVisible();
  });

  test("should submit form and redirect", async ({ page }) => {
    await page.goto("/join/demo-shop/main-queue");

    await page.getByLabel("Your Name").fill("Bob Test");

    // Submit the form
    await page.getByRole("button", { name: "Join Queue" }).click();

    // Should redirect to position page
    await expect(page).toHaveURL(/\/q\/.+/);
    await expect(page.getByText("Your position")).toBeVisible();
  });

  test("should show 'already in queue' when token exists", async ({ page }) => {
    // First join
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Charlie Test");
    await page.getByRole("button", { name: "Join Queue" }).click();
    await expect(page).toHaveURL(/\/q\/.+/);

    // Go back to join page
    await page.goto("/join/demo-shop/main-queue");

    // Should show "already in queue" message
    await expect(page.getByText("You're already in the queue!")).toBeVisible();
    await expect(page.getByRole("button", { name: "Check My Position" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join Again" })).toBeVisible();
  });

  test("should allow checking position from 'already in queue' screen", async ({ page }) => {
    // First join
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Diana Test");
    await page.getByRole("button", { name: "Join Queue" }).click();
    await expect(page).toHaveURL(/\/q\/.+/);

    // Get the token from URL
    const positionUrl = page.url();

    // Go back to join page
    await page.goto("/join/demo-shop/main-queue");

    // Click "Check My Position"
    await page.getByRole("button", { name: "Check My Position" }).click();

    // Should be back at position page
    await expect(page).toHaveURL(positionUrl);
  });

  test("should allow joining again from 'already in queue' screen", async ({ page }) => {
    // First join
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Eve Test");
    await page.getByRole("button", { name: "Join Queue" }).click();
    await expect(page).toHaveURL(/\/q\/.+/);

    // Go back to join page
    await page.goto("/join/demo-shop/main-queue");

    // Click "Join Again"
    await page.getByRole("button", { name: "Join Again" }).click();

    // Should see join form again
    await expect(page.getByRole("heading", { name: "Join the Queue" })).toBeVisible();
    await expect(page.getByLabel("Your Name")).toBeVisible();
  });

  test("should show error for invalid token", async ({ page }) => {
    await page.goto("/q/invalid-token-12345");

    // Should show error message (use heading to be specific)
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
  });

  test("should show 404 for non-existent route", async ({ page }) => {
    await page.goto("/some-random-page");

    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go Home" })).toBeVisible();
  });
});

test.describe("Position Display", () => {
  test("should show position number prominently", async ({ page }) => {
    // Join queue first
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Frank Test");
    await page.getByRole("button", { name: "Join Queue" }).click();

    await expect(page).toHaveURL(/\/q\/.+/);

    // Position should be visible and large
    const positionCard = page.locator("text=Your position").locator("..");
    await expect(positionCard).toBeVisible();

    // Should show position number
    await expect(page.locator(".text-8xl")).toBeVisible();
  });

  test("should show connection status indicator", async ({ page }) => {
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Grace Test");
    await page.getByRole("button", { name: "Join Queue" }).click();

    await expect(page).toHaveURL(/\/q\/.+/);

    // Should show connection indicator
    await expect(page.getByText(/Live|Connecting|Reconnecting|Offline/)).toBeVisible();
  });

  test("should show estimated wait time", async ({ page }) => {
    await page.goto("/join/demo-shop/main-queue");
    await page.getByLabel("Your Name").fill("Henry Test");
    await page.getByRole("button", { name: "Join Queue" }).click();

    await expect(page).toHaveURL(/\/q\/.+/);

    // Should show estimated wait section
    await expect(page.getByText("Estimated wait")).toBeVisible();
  });
});

test.describe("Multiple Customers", () => {
  test("should show correct positions for multiple customers", async ({ browser }) => {
    // Create two separate browser contexts (simulating different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // First customer joins
      await page1.goto("/join/demo-shop/main-queue");
      await page1.getByLabel("Your Name").fill("Customer One");
      await page1.getByRole("button", { name: "Join Queue" }).click();
      await expect(page1).toHaveURL(/\/q\/.+/);

      // Second customer joins
      await page2.goto("/join/demo-shop/main-queue");
      await page2.getByLabel("Your Name").fill("Customer Two");
      await page2.getByRole("button", { name: "Join Queue" }).click();
      await expect(page2).toHaveURL(/\/q\/.+/);

      // Get positions (they should differ)
      const position1Text = await page1.locator(".text-8xl").textContent();
      const position2Text = await page2.locator(".text-8xl").textContent();

      const position1 = parseInt(position1Text || "0");
      const position2 = parseInt(position2Text || "0");

      // Second customer should be behind first
      expect(position2).toBeGreaterThan(position1);
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
