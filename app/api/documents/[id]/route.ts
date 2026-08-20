import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';
import { notifyDocumentAccessUpdated } from '@/lib/ws-notify';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const doc = DocumentService.getDocumentById(id, currentUser.id);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 401 });
    }

    return NextResponse.json({ document: doc, currentUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const body = await req.json();
    const { title, content, isPublic, publicRole, createSnapshot } = body;

    const updated = DocumentService.updateDocument(id, currentUser.id, {
      title,
      content,
      isPublic,
      publicRole,
      createSnapshot
    });

    // Notify connected clients via WebSocket when access or document record is updated
    if (isPublic !== undefined || publicRole !== undefined) {
      await notifyDocumentAccessUpdated(id, {
        action: 'access_updated',
        isPublic: updated.is_public,
        publicRole: updated.public_role,
        updatedBy: currentUser.id
      });
    }

    return NextResponse.json({ document: updated });
  } catch (error: any) {
    let status = 400;
    if (error.message?.includes('access denied') || error.message?.includes('not found')) {
      status = 401;
    } else if (error.message?.includes('Permission denied')) {
      status = 403;
    }
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    DocumentService.deleteDocument(id, currentUser.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    let status = 400;
    if (error.message?.includes('access denied') || error.message?.includes('not found')) {
      status = 401;
    } else if (error.message?.includes('Permission denied')) {
      status = 403;
    }
    return NextResponse.json({ error: error.message }, { status });
  }
}
