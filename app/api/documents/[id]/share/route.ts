import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';
import { UserRole } from '@/lib/types';
import { notifyDocumentAccessUpdated } from '@/lib/ws-notify';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const body = await req.json();
    const { targetUserId, role } = body;

    if (!targetUserId || !role) {
      return NextResponse.json({ error: 'targetUserId and role are required' }, { status: 400 });
    }

    const share = DocumentService.shareDocument(id, currentUser.id, targetUserId, role as UserRole);

    // Send WebSocket notification for updating the document's record across clients
    await notifyDocumentAccessUpdated(id, {
      action: 'share_updated',
      targetUserId,
      role,
      updatedBy: currentUser.id
    });

    return NextResponse.json({ share });
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
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId is required in query parameters' }, { status: 400 });
    }

    DocumentService.removeShare(id, currentUser.id, targetUserId);

    // Send WebSocket notification for updating the document's record across clients
    await notifyDocumentAccessUpdated(id, {
      action: 'share_removed',
      targetUserId,
      updatedBy: currentUser.id
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes('Permission denied') ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
