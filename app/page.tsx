import { getCurrentUser } from '@/lib/auth';
import { DocumentService } from '@/lib/doc-service';
import { Navbar } from '@/components/Navbar';
import { DocumentList } from '@/components/DocumentList';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const initialDocuments = DocumentService.listDocuments(currentUser.id, 'all');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar currentUser={currentUser} />
      <main className="flex-1">
        <DocumentList initialDocuments={initialDocuments} currentUser={currentUser} />
      </main>
    </div>
  );
}
