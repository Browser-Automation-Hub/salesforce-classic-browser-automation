/**
 * actions.js — Core automation actions for Salesforce Classic
 *
 * Each function accepts a Puppeteer Page instance and options.
 * All actions use retry() + humanDelay() for reliability.
 */
'use strict';

require('dotenv').config();

/**
 * login_salesforce — Authenticate to Salesforce Classic with SSO/MFA
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function login_salesforce(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: login_salesforce', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      await page.goto('https://login.salesforce.com', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#username, input[name="username"]', { timeout: 15000 });
    await page.type('#username', process.env.SALESFORCE_CLASSIC_USERNAME);
    await page.type('#password', process.env.SALESFORCE_CLASSIC_PASSWORD);
    await page.click('#Login, input[type="submit"][id="Login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    // Handle MFA if prompted
    const mfaField = await page.$('#smc, input[name="smc"]');
    if (mfaField) {
      const code = generateTOTP(process.env.MFA_SECRET);
      await mfaField.type(code);
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    }
    await page.waitForSelector('#userNavButton, .bPageHeader, #phSearchDiv', { timeout: 20000 });
    return { status: 'logged_in', url: page.url() };
    } catch (err) {
      await page.screenshot({ path: `error-login_salesforce-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * create_lead — Create leads and contacts programmatically
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function create_lead(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: create_lead', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const BASE_URL = process.env.SALESFORCE_CLASSIC_URL || 'https://na.salesforce.com';
    await page.goto(`${BASE_URL}/00Q/e?retURL=%2F00Q%2Fi`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#name_lastlea2, input[name="name_lastlea2"]', { timeout: 15000 });
    if (opts.firstName) await page.type('#name_firstlea2, input[name="name_firstlea2"]', opts.firstName);
    await page.type('#name_lastlea2, input[name="name_lastlea2"]', opts.lastName || opts.name || '');
    if (opts.email) await page.type('#email, input[name="email"]', opts.email);
    if (opts.company) await page.type('#company, input[name="company"]', opts.company);
    if (opts.phone) await page.type('#phone, input[name="phone"]', opts.phone);
    if (opts.leadSource) await page.select('#lead_source, select[name="LeadSource"]', opts.leadSource);
    await page.click('#bottomButtonRow input[name="save"], #topButtonRow input[name="save"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    const leadId = page.url().match(/\/([0-9A-Za-z]{15,18})/)?.[1];
    return { status: 'created', leadId, url: page.url() };
    } catch (err) {
      await page.screenshot({ path: `error-create_lead-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * update_opportunity — Bulk update opportunity stage and fields
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function update_opportunity(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: update_opportunity', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual Salesforce Classic selectors
    // await page.goto(`${process.env.SALESFORCE_CLASSIC_URL}/path/to/update-opportunity`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('update_opportunity complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-update_opportunity-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * run_report — Run and export Salesforce reports to CSV
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function run_report(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: run_report', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      const BASE_URL = process.env.SALESFORCE_CLASSIC_URL || 'https://na.salesforce.com';
    // Navigate to Reports tab
    await page.goto(`${BASE_URL}/00O?setupid=TabReports`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.reportFolderItem, .ReportName a, .dataRow', { timeout: 15000 });
    if (opts.reportId) {
      await page.goto(`${BASE_URL}/${opts.reportId}?export=1&enc=UTF-8&xf=csv`);
    } else if (opts.reportName) {
      const link = await page.evaluateHandle((name) =>
        Array.from(document.querySelectorAll('.ReportName a, .dataRow .titleCell a')).find(a => a.textContent.includes(name)),
        opts.reportName
      );
      if (link) await link.asElement()?.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      await page.click('#export_btn, input[value="Export Details"]').catch(() => {});
    }
    return { status: 'ok', url: page.url() };
    } catch (err) {
      await page.screenshot({ path: `error-run_report-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

/**
 * mass_update_records — Mass update records that DLRS/Data Loader cannot handle
 * @param {import('puppeteer').Page} page
 * @param {Object} opts
 * @returns {Promise<Object>}
 */
async function mass_update_records(page, opts = {}) {
  const { retry, humanDelay, log } = require('./utils');

  log('Running: mass_update_records', opts);

  return retry(async () => {
    await humanDelay(500, 1500);
    try {
      // TODO: Replace with actual Salesforce Classic selectors
    // await page.goto(`${process.env.SALESFORCE_CLASSIC_URL}/path/to/mass-update-records`);
    // await page.waitForSelector('.main-content, #content, [data-testid="loaded"]', { timeout: 15000 });
    const result = await page.evaluate(() => {
      return { status: 'ok', data: null };
    });
    log('mass_update_records complete', result);
    return result;
    } catch (err) {
      await page.screenshot({ path: `error-mass_update_records-${Date.now()}.png` }).catch(() => {});
      throw err;
    }
  }, { attempts: 3, delay: 2000 });
}

module.exports = {
  login_salesforce,
  create_lead,
  update_opportunity,
  run_report,
  mass_update_records,
};
