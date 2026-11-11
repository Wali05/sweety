// Shown in place of data that is not there. hint is an optional second line
// that says what to do next; id lets a field point at the message.
export default function EmptyState({ id, hint, children }) {
  return (
    <div className="empty" id={id}>
      <p>{children}</p>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
