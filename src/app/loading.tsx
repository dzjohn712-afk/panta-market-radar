export default function Loading() {
  return (
    <main className="shell loading-shell" aria-busy="true">
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-label" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton-label" />
      <div className="skeleton skeleton-table" />
    </main>
  );
}
