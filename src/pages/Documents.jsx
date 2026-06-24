import React from 'react';
import { FileText, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Documents() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Store and organise your business documents.</p>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
      </div>

      <div className="border border-dashed border-border rounded-xl py-16 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <FolderOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium">No documents yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Upload invoices, receipts, statements, and contracts to keep everything in one place.
        </p>
      </div>
    </div>
  );
}