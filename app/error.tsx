"use client";
export default function ArchiveError({ retry }: { retry: () => void }) {
  return (
    <main className="sign-in-page">
      <section className="sign-in-card">
        <h1>Your archive could not be loaded</h1>
        <p>
          Your saved data has been kept. Try again. If this continues, check the
          database connection and saved lesson/progress format.
        </p>
        <button className="primary" onClick={retry}>
          Try again
        </button>
      </section>
    </main>
  );
}
