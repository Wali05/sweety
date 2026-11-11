import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Loading from '../ui/Loading.jsx';

describe('shared UI states', () => {
  it('announces errors immediately and success messages politely', () => {
    const { rerender } = render(<Alert title="Could not save.">Try again.</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('alert', 'alert-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Try again.');

    rerender(<Alert kind="success">Reading saved.</Alert>);
    expect(screen.getByRole('status')).toHaveClass('alert-success');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links an empty state to its field and includes the next step', () => {
    render(
      <>
        <input aria-describedby="date-problem" />
        <EmptyState id="date-problem" hint="Choose another day.">
          No readings for this date yet.
        </EmptyState>
      </>
    );

    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'No readings for this date yet. Choose another day.'
    );
  });

  it('uses a polite loading status with a specific message', () => {
    render(<Loading>Loading readings…</Loading>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading readings…');
    expect(screen.getByRole('status')).toHaveClass('loading');
  });
});
