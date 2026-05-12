// lib/checklists/index.ts — Checklist loader
import ukChecklist from './UK-SVV-01.json';
import schChecklist from './SCH-CSS-01.json';

export interface ChecklistRequirement {
  id: string;
  category: string;
  document: string;
  mandatory: boolean;
  validity_months?: number;
  months_required?: number;
  min_balance_gbp?: number;
}

export interface Checklist {
  checklist_id: string;
  country: string;
  visa_type: string;
  flag: string;
  requirements: ChecklistRequirement[];
}

const CHECKLISTS: Record<string, Checklist> = {
  'UK-SVV-01':  ukChecklist  as Checklist,
  'SCH-CSS-01': schChecklist as Checklist,
};

export function getChecklist(id: string): Checklist {
  const checklist = CHECKLISTS[id];
  if (!checklist) {
    throw new Error(`Unknown checklist ID: "${id}". Valid IDs: ${Object.keys(CHECKLISTS).join(', ')}`);
  }
  return checklist;
}

export function getAllChecklists(): Checklist[] {
  return Object.values(CHECKLISTS);
}
