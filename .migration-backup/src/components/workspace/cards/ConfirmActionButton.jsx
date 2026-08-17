import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight } from 'lucide-react';

// Action button that requires explicit confirmation when `destructive` is true.
// Used for irreversible collections actions (place account on hold, legal
// escalation). Non-destructive actions fire immediately.
export default function ConfirmActionButton({
  label, onClick, destructive = false, description, className, size = 'sm', icon: Icon, variant,
}) {
  const [open, setOpen] = useState(false);
  const run = () => { setOpen(false); onClick?.(); };

  if (!destructive) {
    return (
      <Button onClick={onClick} size={size} variant={variant} className={className}>
        {Icon && <Icon className="w-3.5 h-3.5" />} {label} <ArrowRight className="w-3 h-3 opacity-70" />
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant={variant || 'destructive'} size={size} onClick={() => setOpen(true)} className={className}>
        {Icon && <Icon className="w-3.5 h-3.5" />} {label} <ArrowRight className="w-3 h-3 opacity-70" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm action</AlertDialogTitle>
          <AlertDialogDescription>
            {description || `Are you sure you want to "${label}"? This affects this customer's account.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={run}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}