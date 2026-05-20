export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-8 h-8 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin"
          aria-hidden
        />
        <p className="text-sm text-neutral-500" aria-live="polite">
          Cargando…
        </p>
      </div>
    </div>
  );
}
