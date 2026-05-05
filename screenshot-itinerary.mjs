import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  
  // Go to login
  await page.goto('http://localhost:3001/login');
  await page.waitForLoadState('networkidle');
  
  // Login
  await page.fill('input[type="email"]', 'gusguecas@gmail.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  // Navigate to itinerary
  await page.goto('http://localhost:3001/trips/buAXbSYsrui9vN6mcW0g/itinerary');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  await page.screenshot({
    path: '/tmp/itinerary-screenshot.png',
    fullPage: false,
  });
  
  console.log('Screenshot saved');
  await browser.close();
}

main().catch(console.error);
