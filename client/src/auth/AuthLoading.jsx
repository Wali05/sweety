// Shown by the route guards while a stored session is being checked.
export default function AuthLoading() {
  return (
    <p className="loading" role="status">
      Loading…
    </p>
  );
}
