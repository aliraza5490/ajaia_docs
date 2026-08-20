import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ajaia Docs – Collaborative Document Workspace',
  description: 'Fast, modern rich-text document editor with multi-user sharing, file imports (.docx, .md, .txt), attachments, and revision history.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
