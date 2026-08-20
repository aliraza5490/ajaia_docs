import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';
import { DocumentEditor } from '@/components/Editor/DocumentEditor';
import { Navbar } from '@/components/Navbar';
import { FileQuestion, Lock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocPage({ params }: PageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const document = DocumentService.getDocumentById(id, currentUser.id);

  if (!document) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar currentUser={currentUser} />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Document Not Accessible</h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This document does not exist, or you ({currentUser.name}) do not have permission to view it.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link
                href="/"
                className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspace
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <DocumentEditor initialDocument={document} currentUser={currentUser} />;
}
