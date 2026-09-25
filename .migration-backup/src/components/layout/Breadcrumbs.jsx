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
    crumbs = [{ label: 'Dashboard' }];
  } else {
    crumbs = [{ label: item.sectionLabel }, { label: item.label, path: item.path }];
    const rest = location.pathname.slice(item.path.length).replace(/^\//, '');
    if (rest === 'new') crumbs.push({ label: 'New' });
    else if (rest) crumbs.push({ label: 'Details' });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground py-1">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
            {c.path && !last ? (
              <Link to={c.path} className="hover:text-foreground transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-foreground font-medium' : ''}>{c.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}