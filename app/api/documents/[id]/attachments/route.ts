import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    
    // Support multipart form-data or JSON with base64
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${base64}`;

      const attachment = DocumentService.addAttachment(id, currentUser.id, {
        filename: file.name,
        filesize: file.size,
        filetype: file.type || 'application/octet-stream',
        dataUrl
      });

      return NextResponse.json({ attachment }, { status: 201 });
    } else {
      const body = await req.json();
      const { filename, filesize, filetype, dataUrl } = body;
      
      if (!filename || !dataUrl) {
        return NextResponse.json({ error: 'Missing attachment details' }, { status: 400 });
      }

      const attachment = DocumentService.addAttachment(id, currentUser.id, {
        filename,
        filesize: filesize || 0,
        filetype: filetype || 'application/octet-stream',
        dataUrl
      });

      return NextResponse.json({ attachment }, { status: 201 });
    }
  } catch (error: any) {
    const status = error.message.includes('Permission denied') ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }

    DocumentService.removeAttachment(attachmentId, currentUser.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes('Permission denied') ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
