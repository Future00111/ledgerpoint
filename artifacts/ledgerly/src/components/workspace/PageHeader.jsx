/** One readable heading and action hierarchy across the daily workspace. */
export default function PageHeader({ eyebrow, title, description, context, actions, children }) {
  return <header className="workspace-heading">
    <div className="min-w-0 flex-1">
      {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
      <h1 className="workspace-title">{title}</h1>
      {description && <p className="workspace-description">{description}</p>}
      {context && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{context}</div>}
      {children}
    </div>
    {actions && <div className="workspace-heading-actions">{actions}</div>}
  </header>;
}
