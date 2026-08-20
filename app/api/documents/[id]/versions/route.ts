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
    const versions = DocumentService.listVersions(id, currentUser.id);
    return NextResponse.json({ versions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();
    const body = await req.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    const restoredDoc = DocumentService.restoreVersion(id, versionId, currentUser.id);
    return NextResponse.json({ document: restoredDoc });
  } catch (error: any) {
    const status = error.message.includes('Permission denied') ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
