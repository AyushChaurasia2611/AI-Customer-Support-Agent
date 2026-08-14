import { test, expect } from "@playwright/test";

test.describe("AI Refund Support Agent E2E Flows", () => {
  test("DEMO 1: Standard Eligible Refund Flow for ORD1001", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("h2")).toContainText("Active Customer Context");

    // Select DEMO 1 scenario (Alice Smith / ORD1001)
    await page.selectOption("select", "CUST-001");
    await expect(page.locator("body")).toContainText("CUST-001");
    await expect(page.locator("body")).toContainText("ORD1001");

    // Click quick prompt button
    await page.click('button:has-text("Request refund for ORD1001")');

    // Wait for the agent response bubble and assert the decision badge
    await expect(page.locator("text=Decision: APPROVED").last()).toBeVisible({ timeout: 30000 });
  });

  test("DEMO 2: Policy Violation Expired Refund Flow for ORD1002", async ({ page }) => {
    await page.goto("/chat");

    // Select DEMO 2 scenario (Bob Jones / ORD1002)
    await page.selectOption("select", "CUST-002");
    await expect(page.locator("body")).toContainText("CUST-002");
    await expect(page.locator("body")).toContainText("ORD1002");

    // Type prompt manually
    await page.fill('input[type="text"]', "I want a refund for ORD1002");
    await page.click('button[type="submit"]');

    // Wait for the agent response bubble and assert the decision badge
    await expect(page.locator("text=Decision: DENIED").last()).toBeVisible({ timeout: 30000 });
  });

  test("Admin Dashboard navigation and telemetry view", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText("Agent Telemetry & Admin Command Center");
    await expect(page.locator("body")).toContainText("Total Customers");
    await expect(page.locator("body")).toContainText("Approved Refunds");

    // Navigate to sessions
    await page.click('a:has-text("Agent Sessions")');
    await expect(page).toHaveURL("/admin/sessions");
    await expect(page.locator("h1")).toContainText("Agent Execution Sessions");

    // Navigate to Policy page
    await page.click('a:has-text("Refund Policy")');
    await expect(page).toHaveURL("/admin/policy");
    await expect(page.locator("h1")).toContainText("Deterministic E-Commerce Refund Policy");

    // Policy page must serve the real policy file (previously 404'd hardcoded fallback)
    await expect(page.locator("body")).toContainText("30 calendar days of delivery");
    await expect(page.locator("body")).toContainText("HUMAN_REVIEW");
  });
});