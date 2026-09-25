import React, { useState } from 'react';
import { Building2, Wrench, HardHat, UtensilsCrossed, Store, ShoppingBag, Home, Briefcase, Hammer, MoreHorizontal } from 'lucide-react';

const BUSINESS_TYPES = [
  { value: 'general_business', label: 'General Business', icon: Building2, description: 'Standard trading company' },
  { value: 'garage', label: 'Garage', icon: Wrench, description: 'Motor trade & repairs' },
  { value: 'construction', label: 'Construction', icon: HardHat, description: 'Building & contracting' },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed, description: 'Food & hospitality' },
  { value: 'retail', label: 'Retail', icon: Store, description: 'Shop & storefront' },
  { value: 'ecommerce', label: 'E-commerce', icon: ShoppingBag, description: 'Online selling' },
  { value: 'property', label: 'Property', icon: Home, description: 'Lettings & property' },
  { value: 'consultant', label: 'Consultant', icon: Briefcase, description: 'Professional services' },
  { value: 'tradesperson', label: 'Tradesperson', icon: Hammer, description: 'Skilled trade' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, description: 'Something else' },
];

export default function SetupStep2BusinessType({ data, onUpdate }) {
  const [selected, setSelected] = useState(data || 'general_business');

  const handleSelect = (type) => {
    setSelected(type);
    onUpdate(type);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Select the type of business that best describes your operation.</p>
        <p className="text-xs text-muted-foreground mt-1">Your choice tailors the dashboard widgets and default chart of accounts — the accounting engine stays the same for all business types.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {BUSINESS_TYPES.map(type => {
          const Icon = type.icon;
          const isSelected = selected === type.value;
          return (
            <button
              key={type.value}
              onClick={() => handleSelect(type.value)}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all text-center ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium text-foreground">{type.label}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{type.description}</span>
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