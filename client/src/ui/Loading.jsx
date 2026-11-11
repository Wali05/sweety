// Shown while something is being fetched. The spinner is drawn in CSS.
export default function Loading({ children = 'Loading…' }) {
  return (
    <p className="loading" role="status">
      {children}
    </p>
  );
}
