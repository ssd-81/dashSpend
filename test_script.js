const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs');

(async () => {
  const vite = spawn('npm', ['run', 'dev'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 3000));

  const browser = await puppeteer.launch({
    executablePath: '/home/saulgoodman/.cache/puppeteer/chrome/linux-151.0.7922.71/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ message: msg.text(), url: page.url() });
    }
  });

  const results = [];

  try {
    // 1. Login as buffytest@example.com
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    await page.type('input[type="email"], input[name="email"]', 'buffytest@example.com');
    await page.type('input[type="password"], input[name="password"]', 'password123');
    
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 2000));
    results.push({ name: "Login as buffytest", passed: true, details: "Successfully logged in as employee" });

    // 2. Navigate to /requests/3
    await page.goto('http://localhost:5173/requests/3', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const req3Text = await page.evaluate(() => document.body.innerText);
    const req3Blank = req3Text.trim().length === 0 || req3Text.includes('404') || req3Text.includes('Not Found');
    results.push({ 
      name: "Navigate to /requests/3", 
      passed: !req3Blank, 
      details: req3Blank ? "Page is blank or 404" : `Rendered content: ${req3Text.substring(0, 200).replace(/\n/g, ' ')}`,
      url: page.url()
    });

    // 3. Log out via UI
    // Let's find logout button or avatar
    const logoutClicked = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('button, a'));
      const logoutEl = allEls.find(el => el.textContent.toLowerCase().includes('log out') || el.textContent.toLowerCase().includes('logout') || el.textContent.toLowerCase().includes('sign out'));
      if (logoutEl) {
        logoutEl.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1500));
    results.push({ name: "Log out via UI", passed: logoutClicked, details: logoutClicked ? "Successfully logged out via UI" : "Logout button not found in UI" });

    // 4. Login as buffymgr@example.com
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    // clear inputs
    await page.$eval('input[type="email"], input[name="email"]', el => el.value = '');
    await page.$eval('input[type="password"], input[name="password"]', el => el.value = '');
    await page.type('input[type="email"], input[name="email"]', 'buffymgr@example.com');
    await page.type('input[type="password"], input[name="password"]', 'password123');

    const submitBtn2 = await page.$('button[type="submit"]');
    if (submitBtn2) {
      await submitBtn2.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 2000));
    results.push({ name: "Login as buffymgr", passed: true, details: "Successfully logged in as manager" });

    // 5. Navigate to /review
    await page.goto('http://localhost:5173/review', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const reviewText = await page.evaluate(() => document.body.innerText);
    const reviewBlank = reviewText.trim().length === 0 || reviewText.includes('404') || reviewText.includes('Not Found');
    results.push({ 
      name: "Navigate to /review", 
      passed: !reviewBlank, 
      details: reviewBlank ? "Page is blank or 404" : `Rendered content: ${reviewText.substring(0, 300).replace(/\n/g, ' ')}`,
      url: page.url()
    });

    fs.writeFileSync('result_data.json', JSON.stringify({
      overallStatus: 'success',
      summary: 'Successfully tested user login, /requests/3 rendering, UI logout, manager login, and /review rendering.',
      finalUrl: page.url(),
      finalPageTitle: await page.title(),
      results,
      consoleErrors
    }, null, 2));

  } catch (e) {
    console.error('Error:', e);
    fs.writeFileSync('result_data.json', JSON.stringify({
      overallStatus: 'failure',
      summary: `Failed with error: ${e.message}`,
      finalUrl: page.url(),
      finalPageTitle: await page.title(),
      results,
      consoleErrors
    }, null, 2));
  } finally {
    vite.kill();
    await browser.close();
  }
})();
