'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';
import { useToast } from '@/context/ToastContext';
import DocumentUpload from '@/components/trips/DocumentUpload';
import { ROUTES } from '@/config/constants';

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const { documents, loading, uploadDocument, deleteDocument } = useDocuments(tripId);
  const { toast } = useToast();

  /* ─── Handlers ────────────────────────────────── */

  const handleUpload = async (file: File): Promise<string> => {
    try {
      const url = await uploadDocument(file);
      toast('Documento subido correctamente', 'success');
      return url;
    } catch (error) {
      console.error('Error al subir documento:', error);
      toast('Error al subir el documento', 'error');
      throw error;
    }
  };

  const handleDelete = async (docId: string, url: string) => {
    try {
      await deleteDocument(docId, url);
      toast('Documento eliminado', 'success');
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      toast('Error al eliminar el documento', 'error');
    }
  };

  /* ─── Render ──────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(ROUTES.app.trip(tripId))}
          className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Documentos</h1>
          <p className="text-white/40 text-sm">
            Sube boletos, reservaciones y documentos importantes
          </p>
        </div>
      </div>

      {/* Info rapida */}
      {documents.length > 0 && (
        <div className="glass rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-white/60 text-sm">
            {documents.length} {documents.length === 1 ? 'documento' : 'documentos'} subidos
          </span>
        </div>
      )}

      {/* Componente de upload y lista */}
      <DocumentUpload
        documents={documents}
        onUpload={handleUpload}
        onDelete={handleDelete}
        loading={loading}
      />
    </div>
  );
}
