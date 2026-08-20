import { describe, it, expect } from 'vitest';
import { parseUploadedFile } from '../lib/parsers';

describe('File Upload & Parsing', () => {
  it('should parse Markdown files into HTML and extract title', async () => {
    const mdContent = `# Engineering RFC: Document Architecture\n\nHere is a list of features:\n- Offline sync\n- SQLite WAL persistence\n\n> "Speed is a feature"`;
    const buffer = Buffer.from(mdContent, 'utf-8');

    const result = await parseUploadedFile('rfc-sync.md', buffer);

    expect(result.title).toBe('Engineering RFC: Document Architecture');
    expect(result.html).toContain('Offline sync');
    expect(result.html).toContain('<blockquote>');
  });

  it('should parse Plaintext files (.txt) into paragraphs', async () => {
    const txtContent = `Line 1 of notes\n\nLine 2 of notes with details`;
    const buffer = Buffer.from(txtContent, 'utf-8');

    const result = await parseUploadedFile('Meeting_Notes.txt', buffer);

    expect(result.title).toBe('Meeting_Notes');
    expect(result.html).toContain('<p>Line 1 of notes</p>');
    expect(result.html).toContain('<p>Line 2 of notes with details</p>');
  });
});
