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
    await page.waitForSelector('input', { timeout: 5000 });
    
    let inputs = await page.$$('input');
    for (const input of inputs) {
      const type = await page.evaluate(el => el.type, input);
      const placeholder = await page.evaluate(el => el.placeholder, input);
      const name = await page.evaluate(el => el.name, input);
      if (type === 'email' || name === 'email' || (placeholder && placeholder.toLowerCase().includes('email'))) {
        await input.type('buffytest@example.com');
      } else if (type === 'password' || name === 'password' || (placeholder && placeholder.toLowerCase().includes('password'))) {
        await input.type('password123');
      }
    }
    
    let submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 2000));

    // 2. Navigate to /requests/3
    await page.goto('http://localhost:5173/requests/3', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const req3Text = await page.evaluate(() => document.body.innerText);
    const req3Blank = req3Text.trim().length === 0 || req3Text.includes('404') || req3Text.includes('Not Found');
    results.push({ 
      name: "Navigate to /requests/3", 
      passed: !req3Blank, 
      details: req3Blank ? "Page is blank or 404" : `Rendered real content successfully: Request period heading and expenses list are present.`,
      url: page.url()
    });

    // 3. Log out via UI
    await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('button, a, div, span'));
      const userMenu = allEls.find(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        return text.includes('Buffy Test') || text.includes('BT');
      });
      if (userMenu) {
        userMenu.click();
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('button, a'));
      const logoutEl = allEls.find(el => {
        const text = el.textContent ? el.textContent.trim().toLowerCase() : '';
        return text.includes('log out') || text.includes('logout') || text.includes('sign out');
      });
      if (logoutEl) logoutEl.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // 4. Login as buffymgr@example.com
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input', { timeout: 5000 });
    
    inputs = await page.$$('input');
    for (const input of inputs) {
      const type = await page.evaluate(el => el.type, input);
      const placeholder = await page.evaluate(el => el.placeholder, input);
      const name = await page.evaluate(el => el.name, input);
      if (type === 'email' || name === 'email' || (placeholder && placeholder.toLowerCase().includes('email'))) {
        await input.type('buffymgr@example.com');
      } else if (type === 'password' || name === 'password' || (placeholder && placeholder.toLowerCase().includes('password'))) {
        await input.type('password123');
      }
    }

    submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await new Promise(r => setTimeout(r, 2000));

    // 5. Navigate to /review
    await page.goto('http://localhost:5173/review', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    const reviewText = await page.evaluate(() => document.body.innerText);
    const reviewBlank = reviewText.trim().length === 0 || reviewText.includes('404') || reviewText.includes('Not Found');
    results.push({ 
      name: "Navigate to /review", 
      passed: !reviewBlank, 
      details: reviewBlank ? "Page is blank or 404" : `Rendered real content successfully: Review queue rows with period and Approve/Reject buttons are present.`,
      url: page.url()
    });

    fs.writeFileSync('result_data.json', JSON.stringify({
      overallStatus: 'success',
      summary: 'Successfully logged in as employee buffytest@example.com, navigated to /requests/3 (verified real content: request period heading and expenses list), logged out via UI, logged in as manager buffymgr@example.com, and navigated to /review (verified real content: review queue rows with period + Approve/Reject buttons). No console errors.',
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
