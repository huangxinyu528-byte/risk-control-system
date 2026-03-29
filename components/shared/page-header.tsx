type PageHeaderProps = {
  title: string;
  description: string;
  actionLabel?: string;
};

export function PageHeader({
  title,
  description,
  actionLabel,
}: PageHeaderProps) {
  return (
    <section className="page-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel ? (
        <button className="button button-secondary" type="button">
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
