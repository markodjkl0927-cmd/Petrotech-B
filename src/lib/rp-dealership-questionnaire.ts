type DealershipFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'checkbox' | 'select';

type DealershipFieldDef = {
  key: string;
  label: string;
  required: boolean;
  type?: DealershipFieldType;
  step: number;
};

const DEALERSHIP_FIELDS: DealershipFieldDef[] = [
  { key: 'companyName', label: 'Company / dealership name', required: true, step: 1 },
  { key: 'legalBusinessName', label: 'Legal business name (if different)', required: false, step: 1 },
  { key: 'contactName', label: 'Primary contact name', required: true, step: 1 },
  { key: 'contactTitle', label: 'Contact title / role', required: false, step: 1 },
  { key: 'contactEmail', label: 'Contact email', type: 'email', required: true, step: 1 },
  { key: 'contactPhone', label: 'Contact phone', type: 'tel', required: true, step: 1 },
  { key: 'website', label: 'Business website', required: false, step: 1 },

  { key: 'businessAddress', label: 'Street address', required: true, step: 2 },
  { key: 'city', label: 'City', required: true, step: 2 },
  { key: 'state', label: 'State', type: 'select', required: true, step: 2 },
  { key: 'zipCode', label: 'ZIP code', required: true, step: 2 },
  { key: 'yearsInBusiness', label: 'Years in business', required: true, step: 2 },
  { key: 'numberOfLocations', label: 'Number of locations', type: 'select', required: true, step: 2 },
  { key: 'dealershipType', label: 'Primary business type', type: 'select', required: true, step: 2 },
  { key: 'hoursOfOperation', label: 'Hours of operation', required: false, step: 2 },

  { key: 'monthlyVolume', label: 'Estimated monthly fuel volume', type: 'select', required: true, step: 3 },
  { key: 'currentFuelBrands', label: 'Current fuel brands supplied', required: false, step: 3 },
  { key: 'storageCapacity', label: 'Fuel storage capacity', required: false, step: 3 },
  { key: 'employeeCount', label: 'Number of employees', type: 'select', required: false, step: 3 },
  { key: 'priorRpRelationship', label: 'Prior R&P relationship', type: 'checkbox', required: false, step: 3 },
  { key: 'additionalInfo', label: 'Additional information', type: 'textarea', required: false, step: 3 },

  { key: 'agreeTerms', label: 'Agreed to be contacted', type: 'checkbox', required: true, step: 4 },
  { key: 'agreeAccurate', label: 'Confirmed information is accurate', type: 'checkbox', required: true, step: 4 },
];

const ALLOWED_KEYS = new Set(DEALERSHIP_FIELDS.map((field) => field.key));

export function validateDealershipAnswers(
  answers: unknown
): { ok: true; sanitized: Record<string, string | boolean> } | { ok: false; error: string } {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, error: 'Application answers are required' };
  }

  const raw = answers as Record<string, unknown>;
  const sanitized: Record<string, string | boolean> = {};

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: `Unknown field: ${key}` };
    }
  }

  for (const field of DEALERSHIP_FIELDS) {
    const value = raw[field.key];

    if (field.type === 'checkbox') {
      sanitized[field.key] = value === true || value === 'true';
      if (field.required && !sanitized[field.key]) {
        return { ok: false, error: `${field.label} is required` };
      }
      continue;
    }

    if (value === undefined || value === null || value === '') {
      if (field.required) {
        return { ok: false, error: `${field.label} is required` };
      }
      continue;
    }

    if (typeof value !== 'string') {
      return { ok: false, error: `${field.label} must be text` };
    }

    const trimmed = value.trim();
    if (!trimmed) {
      if (field.required) {
        return { ok: false, error: `${field.label} is required` };
      }
      continue;
    }

    if (field.key === 'contactEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: 'Enter a valid contact email' };
    }

    if (field.key === 'zipCode' && !/^\d{5}$/.test(trimmed)) {
      return { ok: false, error: 'Enter a valid 5-digit ZIP code' };
    }

    sanitized[field.key] = trimmed;
  }

  return { ok: true, sanitized };
}
