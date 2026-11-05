import { useEffect, useId, useRef, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { documentIntake } from '@/api/documentIntake.mjs';
import { canPreviewSource, createSourcePreview, sourcePreviewScope } from './sourcePreview.mjs';

export function SourcePreviewView({ filename, state, onOpen, onClose, onImageError, regionId }) {
  const expanded = state.status !== 'closed';
  return <div className="space-y-3">
    <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={expanded ? onClose : onOpen}
      aria-expanded={expanded} aria-controls={regionId} aria-label={`${expanded ? 'Close' : 'Preview'} source image ${filename}`}>
      {expanded ? <X className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      {expanded ? 'Close image preview' : 'Preview source image'}
    </Button>
    {expanded && <section id={regionId} aria-label={`Source image preview: ${filename}`} className="space-y-3 rounded-lg border bg-background p-3">
      {state.status === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading source image…</p>}
      {state.status === 'error' && <div role="alert" className="space-y-2 text-sm"><p>{state.error}</p><Button type="button" variant="outline" size="sm" onClick={onOpen}>Retry image preview</Button></div>}
      {state.status === 'ready' && <div className="max-h-[70vh] overflow-auto"><img src={state.url} alt={`Original source document: ${filename}`} onError={() => onImageError(state.url)} decoding="async" className="h-auto max-w-full" /></div>}
      <p className="text-xs text-muted-foreground">Original image for review. Previewing does not extract fields or change accounting records. Preview supports static images up to 20 megapixels and 10,000 pixels per side; other files remain available to download.</p>
    </section>}
  </div>;
}

function ScopedSourcePreview({ companyId, source }) {
  const regionId = useId();
  const [state, setState] = useState({ status: 'closed', url: null, error: null });
  const preview = useRef(null);
  const open = () => {
    preview.current ??= createSourcePreview({ companyId, source, load: documentIntake.content, publish: setState });
    return preview.current.open();
  };
  useEffect(() => () => { preview.current?.dispose(); preview.current = null; }, []);
  return <SourcePreviewView filename={source.filename} state={state} regionId={regionId}
    onOpen={open} onClose={() => preview.current?.close()} onImageError={url => preview.current?.imageFailed(url)} />;
}

export default function SourcePreview({ companyId, source }) {
  if (!canPreviewSource(source)) return <p className="text-xs text-muted-foreground">{source?.media_type === 'application/pdf'
    ? 'PDF preview is not available here. Download the source file to review it.'
    : 'This file type cannot be previewed here. Download the source file to review it.'}</p>;
  // Keying the entire stateful viewer hides old company/source content during render, before effects run.
  return <ScopedSourcePreview key={sourcePreviewScope(companyId, source)} companyId={companyId} source={source} />;
}
