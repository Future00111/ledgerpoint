import React, { useState } from 'react';
import { Wrench, Store, UtensilsCrossed, Briefcase, Users, MoreHorizontal } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'garage', label: 'Garage', icon: Wrench },
  { value: 'retail', label: 'Retail', icon: Store },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { value: 'professional_services', label: 'Consultant', icon: Briefcase },
  { value: 'construction', label: 'Tradesperson', icon: Users },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

export default function SetupStep2BusinessType({ data, onUpdate }) {
  const [selected, setSelected] = useState(data || 'garage');

  const handleSelect = (type) => {
    setSelected(type);
    onUpdate(type);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Select the type of business that best describes your operation.</p>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {BUSINESS_TYPES.map(type => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => handleSelect(type.value)}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                selected === type.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${selected === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-center text-foreground">{type.label}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-900">
            Selected: <span className="font-semibold">{BUSINESS_TYPES.find(t => t.value === selected)?.label}</span>
          </p>
        </div>
      )}
    </div>
  );
}