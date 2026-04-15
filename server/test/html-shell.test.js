// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('html shell', () => {
  it('keeps index.html as an application shell without hardcoded domain facts', async () => {
    const htmlPath = path.resolve('index.html');
    const html = await fs.readFile(htmlPath, 'utf8');

    expect(html).toMatch(/<div id="app"><\/div>/i);
    expect(html).toMatch(/<script type="module" src="\/client\/src\/main\.jsx"><\/script>/i);

    const bannedDomainTerms = [
      'DENTAL / DENCLASS',
      'Optima',
      'Essence',
      'JOMIS',
      'Digital Biobank',
      'MHS Genesis',
      'What decisions were made this sprint?',
    ];

    for (const term of bannedDomainTerms) {
      expect(html).not.toContain(term);
    }
  });
});
