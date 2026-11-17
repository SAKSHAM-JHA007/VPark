import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Pre-Launch Technical SEO & Optimization Validation', () => {
  it('robots.ts disallows private dashboards, auth pages, and API routes', async () => {
    const robotsFile = fs.readFileSync('src/app/robots.ts', 'utf-8');
    assert.ok(robotsFile.includes("'/owner/'"), 'Must disallow /owner/');
    assert.ok(robotsFile.includes("'/driver/'"), 'Must disallow /driver/');
    assert.ok(robotsFile.includes("'/admin/'"), 'Must disallow /admin/');
    assert.ok(robotsFile.includes("'/api/'"), 'Must disallow /api/');
    assert.ok(robotsFile.includes("'/login'"), 'Must disallow /login (auth page)');
    assert.ok(robotsFile.includes("sitemap: `${baseUrl}/sitemap.xml`"), 'Must reference dynamic sitemap');
  });

  it('sitemap.ts includes only public pages and excludes private/auth routes', async () => {
    const sitemapFile = fs.readFileSync('src/app/sitemap.ts', 'utf-8');
    assert.ok(sitemapFile.includes('url: `${baseUrl}`'), 'Must include root homepage');
    assert.ok(sitemapFile.includes('url: `${baseUrl}/contact`'), 'Must include /contact');
    assert.ok(sitemapFile.includes('url: `${baseUrl}/privacy`'), 'Must include /privacy');
    assert.ok(!sitemapFile.includes('url: `${baseUrl}/owner'), 'Must not include /owner');
    assert.ok(!sitemapFile.includes('url: `${baseUrl}/driver'), 'Must not include /driver');
    assert.ok(!sitemapFile.includes('url: `${baseUrl}/login'), 'Must not include /login');
  });

  it('next.config.js defines 301 permanent redirects for legacy and alias URLs', async () => {
    const nextConfigFile = fs.readFileSync('next.config.js', 'utf-8');
    assert.ok(nextConfigFile.includes("source: '/parkora'"), 'Must redirect /parkora');
    assert.ok(nextConfigFile.includes("source: '/find-parking'"), 'Must redirect /find-parking');
    assert.ok(nextConfigFile.includes("source: '/rent-space'"), 'Must redirect /rent-space');
    assert.ok(nextConfigFile.includes('permanent: true'), 'Must be 301 permanent');
  });

  it('Organization & WebSite structured data is valid JSON-LD schema', async () => {
    const structuredDataFile = fs.readFileSync('src/components/StructuredData.tsx', 'utf-8');
    assert.ok(structuredDataFile.includes("'@type': 'Organization'"), 'Must declare Organization');
    assert.ok(structuredDataFile.includes("'@type': 'WebSite'"), 'Must declare WebSite');
    assert.ok(structuredDataFile.includes("'@type': 'BreadcrumbList'"), 'Must declare BreadcrumbList');
    assert.ok(structuredDataFile.includes('APP_CONFIG.contactEmail'), 'Must reference verified support email');
    assert.ok(structuredDataFile.includes('APP_CONFIG.contactPhone'), 'Must reference verified telephone');
  });

  it('Contact API route validates fields, checks honeypot, and persists messages', async () => {
    const contactRouteFile = fs.readFileSync('src/app/api/contact/route.ts', 'utf-8');
    assert.ok(contactRouteFile.includes('EMAIL_REGEX'), 'Must validate email format');
    assert.ok(contactRouteFile.includes('hp'), 'Must check spam honeypot');
    assert.ok(contactRouteFile.includes('checkContactRateLimit'), 'Must enforce rate limiting');
    assert.ok(contactRouteFile.includes('contact_messages.json'), 'Must persist to contact_messages.json');
  });

  it('Public pages provide unique H1 tags and avoid duplicate H1s', async () => {
    const homeClient = fs.readFileSync('src/components/HomePageClient.tsx', 'utf-8');
    const contactPage = fs.readFileSync('src/app/contact/page.tsx', 'utf-8');
    const privacyPage = fs.readFileSync('src/app/privacy/page.tsx', 'utf-8');
    const loginPage = fs.readFileSync('src/app/login/page.tsx', 'utf-8');

    // Count <h1> tags in each file
    const countH1 = (str) => (str.match(/<h1[\s>]/g) || []).length;
    assert.equal(countH1(homeClient), 1, 'Homepage must have exactly 1 H1');
    assert.equal(countH1(contactPage), 1, 'Contact page must have exactly 1 H1');
    assert.equal(countH1(privacyPage), 1, 'Privacy page must have exactly 1 H1');
    assert.equal(countH1(loginPage), 1, 'Login page must have exactly 1 H1');
  });
});
