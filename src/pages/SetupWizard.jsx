import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import SetupStep1Company from '@/components/setup_wizard/SetupStep1Company';
import SetupStep2BusinessType from '@/components/setup_wizard/SetupStep2BusinessType';
import SetupStep3VATSetup from '@/components/setup_wizard/SetupStep3VATSetup';
import SetupStep4BankAccount from '@/components/setup_wizard/SetupStep4BankAccount';
import SetupStep5ImportTransactions from '@/components/setup_wizard/SetupStep5ImportTransactions';
import SetupStep6AddCustomer from '@/components/setup_wizard/SetupStep6AddCustomer';
import SetupStep7CreateInvoice from '@/components/setup_wizard/SetupStep7CreateInvoice';
import SetupStep8Completion from '@/components/setup_wizard/SetupStep8Completion';

const STEPS = [
  { number: 1, title: 'Create Company', description: 'Set up your business profile' },
  { number: 2, title: 'Business Type', description: 'Choose your industry' },
  { number: 3, title: 'VAT Setup', description: 'Configure VAT settings' },
  { number: 4, title: 'Bank Account', description: 'Add your bank account' },
  { number: 5, title: 'Import Transactions', description: 'Import bank transactions' },
  { number: 6, title: 'First Customer', description: 'Add a customer' },
  { number: 7, title: 'First Invoice', description: 'Create an invoice' },
  { number: 8, title: 'Completion', description: 'You\'re all set!' },
];

export default function SetupWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    company: null,
    businessType: null,
    vat: { registered: false, scheme: 'standard', frequency: 'quarterly' },
    bankAccount: null,
    customer: null,
    invoice: null,
  });

  const progress = (currentStep / STEPS.length) * 100;

  const updateWizardData = (key, value) => {
    setWizardData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      navigate('/');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleQuit = () => {
    navigate('/');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <SetupStep1Company data={wizardData.company} onUpdate={(data) => updateWizardData('company', data)} onNext={handleNext} />;
      case 2:
        return <SetupStep2BusinessType data={wizardData.businessType} onUpdate={(data) => updateWizardData('businessType', data)} />;
      case 3:
        return <SetupStep3VATSetup data={wizardData.vat} onUpdate={(data) => updateWizardData('vat', data)} />;
      case 4:
        return <SetupStep4BankAccount companyId={wizardData.company?.id} data={wizardData.bankAccount} onUpdate={(data) => updateWizardData('bankAccount', data)} />;
      case 5:
        return <SetupStep5ImportTransactions companyId={wizardData.company?.id} bankAccountId={wizardData.bankAccount?.id} />;
      case 6:
        return <SetupStep6AddCustomer companyId={wizardData.company?.id} data={wizardData.customer} onUpdate={(data) => updateWizardData('customer', data)} />;
      case 7:
        return <SetupStep7CreateInvoice companyId={wizardData.company?.id} customerId={wizardData.customer?.id} data={wizardData.invoice} onUpdate={(data) => updateWizardData('invoice', data)} />;
      case 8:
        return <SetupStep8Completion />;
      default:
        return null;
    }
  };

  const step = STEPS[currentStep - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">LedgerPoint Setup</h1>
              <p className="text-sm text-muted-foreground mt-1">Get your accounting system ready in 8 simple steps</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{currentStep} of {STEPS.length}</p>
              <p className="text-xs text-muted-foreground">{Math.round(progress)}% Complete</p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Title */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-8">
          {renderStep()}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </Button>
          </div>

          <Button
            onClick={handleNext}
            className="gap-2"
          >
            {currentStep === STEPS.length ? 'Finish' : 'Next'}
            {currentStep < STEPS.length && <ChevronRight className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            onClick={handleQuit}
            className="text-muted-foreground hover:text-foreground"
          >
            Exit Setup
          </Button>
        </div>

        {/* Step Indicators */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <button
                key={s.number}
                onClick={() => setCurrentStep(s.number)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  s.number === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : s.number < currentStep
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {s.number}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}