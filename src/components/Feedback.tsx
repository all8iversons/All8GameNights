interface FeedbackProps {
  message: string;
  title?: string;
}

export function LoadingState({ message }: FeedbackProps) {
  return (
    <div className="panel" role="status">
      {message}
    </div>
  );
}

export function ErrorState({ message, title = 'Something went wrong' }: FeedbackProps) {
  return (
    <section className="panel stack" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

export function EmptyState({ message, title }: FeedbackProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{message}</p>
    </section>
  );
}
