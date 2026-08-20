import { marked } from 'marked';
import mammoth from 'mammoth';

export interface ParseResult {
  title: string;
  html: string;
  plainText: string;
}

export async function parseUploadedFile(
  fileName: string,
  buffer: Buffer,
  mimeType?: string
): Promise<ParseResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const baseTitle = fileName.replace(/\.[^/.]+$/, '').trim() || 'Untitled Imported Document';

  if (ext === 'md' || ext === 'markdown') {
    const text = buffer.toString('utf-8');
    const html = await marked.parse(text, { async: true });
    
    // Extract first H1 heading if present for title
    const firstH1Match = text.match(/^#\s+(.+)$/m);
    const title = firstH1Match ? firstH1Match[1].trim() : baseTitle;
    
    return {
      title,
      html,
      plainText: text.slice(0, 500)
    };
  }

  if (ext === 'docx') {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value || '<p>Imported empty docx document.</p>';
    const plain = html.replace(/<[^>]*>?/gm, ' ').slice(0, 500);

    return {
      title: baseTitle,
      html,
      plainText: plain
    };
  }

  if (ext === 'txt') {
    const text = buffer.toString('utf-8');
    const paragraphs = text
      .split(/\r?\n\r?\n/)
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');
    
    return {
      title: baseTitle,
      html: paragraphs || '<p></p>',
      plainText: text.slice(0, 500)
    };
  }

  // Fallback for generic text files
  const text = buffer.toString('utf-8');
  return {
    title: baseTitle,
    html: `<pre><code>${escapeHtml(text)}</code></pre>`,
    plainText: text.slice(0, 500)
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
