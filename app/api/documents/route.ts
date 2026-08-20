import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const filter = (searchParams.get('filter') as 'all' | 'owned' | 'shared') || 'all';
    const q = searchParams.get('q') || '';

    const documents = DocumentService.listDocuments(currentUser.id, filter, q);
    return NextResponse.json({ documents, currentUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const body = await req.json().catch(() => ({}));
    const { title, content, isPublic, publicRole } = body;

    const doc = DocumentService.createDocument({
      title,
      content,
      ownerId: currentUser.id,
      isPublic,
      publicRole
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
