import { useEffect, useId, useRef } from 'react';
import ReadingForm from './ReadingForm.jsx';
import { slotLabel } from './slots.js';

// One row of a day's readings. mode is 'view' (the reading with Edit and
// Delete buttons), 'edit' (an inline edit form) or 'delete' (asking to confirm).
//
// - dayReadings: { date, readings } for the edit form, as in ReadingForm.
// - deleting: true while this reading's delete request is in flight.
// - onEdit(), onAskDelete(): open the edit form or the delete question.
// - onCancel(): close either of them.
// - onSave(changes), onSaved(reading): passed on to the edit form.
// - onConfirmDelete(): delete the reading.
export default function ReadingItem({
  reading,
  mode,
  dayReadings,
  deleting = false,
  onEdit,
  onAskDelete,
  onCancel,
  onSave,
  onSaved,
  onConfirmDelete,
}) {
  const id = useId();
  const editRef = useRef(null);
  const deleteRef = useRef(null);
  // The mode the row closed itself from, so focus can go back to the button
  // that opened it. Not set when the row closes because another one opened.
  const closedFrom = useRef(null);
  const label = slotLabel(reading.slot);

  useEffect(() => {
    const button = { edit: editRef, delete: deleteRef }[closedFrom.current];
    closedFrom.current = null;
    if (mode === 'view') button?.current?.focus();
  }, [mode]);

  function cancel() {
    closedFrom.current = mode;
    onCancel();
  }

  if (mode === 'edit') {
    return (
      <li className="reading-editing">
        <ReadingForm
          label={`Edit ${label} reading`}
          initialValues={{ date: reading.date, slot: reading.slot, value: reading.value }}
          dayReadings={dayReadings}
          readingId={reading.id}
          submitLabel="Save"
          onSave={onSave}
          onSaved={(saved) => {
            closedFrom.current = 'edit';
            onSaved(saved);
          }}
          onCancel={cancel}
        />
      </li>
    );
  }

  const summary = (
    <>
      <span className="reading-slot">{label}</span>
      <span className="reading-value">
        {reading.value} <span className="reading-unit">mg/dl</span>
      </span>
    </>
  );

  if (mode === 'delete') {
    return (
      <li className="reading-confirming">
        {summary}
        <div className="reading-actions" role="group" aria-labelledby={`${id}-question`}>
          <span id={`${id}-question`} className="reading-question">
            Delete this reading?
          </span>
          <button
            type="button"
            className="button button-danger button-small"
            disabled={deleting}
            onClick={() => {
              closedFrom.current = 'delete';
              onConfirmDelete();
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          {/* Focused first, so pressing Enter twice does not delete. */}
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={deleting}
            autoFocus
            onClick={cancel}
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li>
      {summary}
      <div className="reading-actions">
        <button
          ref={editRef}
          type="button"
          className="button button-secondary button-small"
          aria-label={`Edit ${label} reading`}
          disabled={deleting}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          ref={deleteRef}
          type="button"
          className="button button-danger-outline button-small"
          aria-label={`Delete ${label} reading`}
          disabled={deleting}
          onClick={onAskDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
