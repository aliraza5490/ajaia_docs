import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const doc = DocumentService.getDocumentById(id, currentUser.id);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'md';
    const sanitizedTitle = doc.title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    if (format === 'html') {
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
    h1, h2, h3 { color: #0f172a; }
    blockquote { border-left: 4px solid #cbd5e1; margin: 1.5em 0; padding: 0.5em 1em; color: #64748b; }
    pre { background: #f1f5f9; padding: 1em; border-radius: 8px; overflow-x: auto; }
    code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  ${doc.content}
</body>
</html>`;

      return new NextResponse(fullHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.html"`
        }
      });
    }

    if (format === 'txt') {
      const text = doc.content.replace(/<[^>]*>?/gm, '\n').replace(/\n\n+/g, '\n\n').trim();
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.txt"`
        }
      });
    }

    // Default: Return HTML or Markdown-like text
    return new NextResponse(doc.content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${sanitizedTitle}.md"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
