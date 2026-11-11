// A message box: kind is 'error', 'success' or 'info'. Errors are read out at
// once (role="alert"), the others when the screen reader is idle. title is an
// optional lead-in that says what went wrong, shown before the message.
export default function Alert({ kind = 'error', title, children }) {
  return (
    <p className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title} </strong>}
      {children}
    </p>
  );
}
