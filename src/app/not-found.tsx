import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
      <div className="max-w-md w-full text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-neutral-500 mb-3">
          404
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-4">
          No encontramos esta página
        </h1>
        <p className="text-neutral-600 mb-8 text-sm">
          La URL no existe o el viaje fue eliminado.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Volver al dashboard
        </Link>
      </div>
    </div>
  );
}
