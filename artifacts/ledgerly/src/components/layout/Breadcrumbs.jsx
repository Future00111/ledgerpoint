import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { findActiveItem } from './navConfig';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs() {
  const location = useLocation();
  const item = findActiveItem(location.pathname);
  if (!item) return <div className="h-5" />;

  let crumbs;
  if (item.path === '/') {
    crumbs = [{ label: 'Today' }];
  } else {
    crumbs = item.sectionLabel === item.label ? [{ label: item.label, path: item.path }] : [{ label: item.sectionLabel }, { label: item.label, path: item.path }];
    const rest = location.pathname.slice(item.path.length).replace(/^\//, '');
    if (rest === 'new') crumbs.push({ label: 'New' });
    else if (rest) crumbs.push({ label: 'Details' });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-hidden py-1 text-sm text-muted-foreground">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />}
            {c.path && !last ? (
              <Link to={c.path} className="inline-flex min-h-11 shrink-0 items-center rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {c.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined} className={last ? 'truncate font-medium text-foreground' : 'hidden shrink-0 lg:inline'}>{c.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}