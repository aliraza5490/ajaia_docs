import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseUploadedFile } from '@/lib/parsers';
import { DocumentService } from '@/lib/doc-service';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'create'; // 'create' or 'parse_only'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['txt', 'md', 'markdown', 'docx'];

    if (!ext || !allowedExtensions.includes(ext)) {
      return NextResponse.json({ 
        error: `Unsupported file format ".${ext}". Allowed formats are: .txt, .md, .docx` 
      }, { status: 400 });
    }

    // Limit file size to 15MB for practical performance
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 15MB limit' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const parsed = await parseUploadedFile(fileName, buffer, file.type);

    if (mode === 'parse_only') {
      return NextResponse.json({
        title: parsed.title,
        html: parsed.html,
        plainText: parsed.plainText
      });
    }

    // Create new document from uploaded file
    const doc = DocumentService.createDocument({
      title: parsed.title,
      content: parsed.html,
      ownerId: currentUser.id
    });

    return NextResponse.json({ 
      success: true, 
      document: doc,
      message: `Successfully imported "${fileName}" as a new document!`
    }, { status: 201 });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process uploaded file' }, { status: 500 });
  }
}
