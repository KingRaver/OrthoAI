export interface ICD10Code {
  code: string;
  short_description: string;
  long_description: string | null;
  category: string | null;
  chapter: string | null;
  is_billable: boolean;
  created_at: string;
}

export interface CPTCode {
  code: string;
  description: string;
  long_description: string | null;
  category: string | null;
  subcategory: string | null;
  relative_value_units: number | null;
  created_at: string;
}

export interface Drug {
  id: string;
  name: string;
  generic_name: string | null;
  brand_names: string[];
  drug_class: string | null;
  route: string | null;
  dosage_forms: string[];
  typical_dosing: string | null;
  max_dose: string | null;
  contraindications: string[];
  interactions: string[];
  warnings: string[];
  orthopedic_uses: string[];
  created_at: string;
  updated_at: string;
}

export interface CodeSearchOptions {
  limit?: number;
  category?: string;
}

export interface ICD10Input {
  code: string;
  short_description: string;
  long_description?: string | null;
  category?: string | null;
  chapter?: string | null;
  is_billable?: boolean;
}

export interface CPTInput {
  code: string;
  description: string;
  long_description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  relative_value_units?: number | null;
}

export interface DrugInput {
  name: string;
  generic_name?: string | null;
  brand_names?: string[];
  drug_class?: string | null;
  route?: string | null;
  dosage_forms?: string[];
  typical_dosing?: string | null;
  max_dose?: string | null;
  contraindications?: string[];
  interactions?: string[];
  warnings?: string[];
  orthopedic_uses?: string[];
}
