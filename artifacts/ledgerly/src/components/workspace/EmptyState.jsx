export default function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="flex flex-col items-center px-5 py-12 text-center sm:py-16">
    {Icon && <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></span>}
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>;
}
