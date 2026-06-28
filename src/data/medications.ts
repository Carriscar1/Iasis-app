import type { MedForm } from '../types';

// ─────────────────────────────────────────────
//  IASIS — Catálogo de medicamentos
//  Base local de remédios comuns no Brasil para a barra de busca ao
//  cadastrar uma nova dose. Cada item traz dosagens típicas e a forma.
//  (Lista educacional para o TCC — não substitui orientação médica.)
// ─────────────────────────────────────────────

export interface CatalogMed {
  name:      string;       // princípio ativo / nome comum
  brand?:    string;       // marca comercial conhecida (opcional)
  dosages:   string[];     // apresentações comuns
  form:      MedForm;
  category:  string;       // grupo terapêutico
}

export const MEDICATION_CATALOG: CatalogMed[] = [
  // ── Cardiovascular / Pressão ──
  { name: 'Losartana',        brand: 'Cozaar',    dosages: ['25mg', '50mg', '100mg'],        form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Enalapril',        brand: 'Renitec',   dosages: ['5mg', '10mg', '20mg'],          form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Captopril',        brand: 'Capoten',   dosages: ['12,5mg', '25mg', '50mg'],       form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Anlodipino',       brand: 'Norvasc',   dosages: ['2,5mg', '5mg', '10mg'],         form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Hidroclorotiazida',brand: 'Clorana',   dosages: ['25mg', '50mg'],                 form: 'comprimido', category: 'Diurético' },
  { name: 'Furosemida',       brand: 'Lasix',     dosages: ['20mg', '40mg'],                 form: 'comprimido', category: 'Diurético' },
  { name: 'Atenolol',         brand: 'Atenol',    dosages: ['25mg', '50mg', '100mg'],        form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Propranolol',      brand: 'Inderal',   dosages: ['10mg', '40mg', '80mg'],         form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Carvedilol',       brand: 'Coreg',     dosages: ['3,125mg', '6,25mg', '12,5mg', '25mg'], form: 'comprimido', category: 'Cardíaco' },
  { name: 'Valsartana',       brand: 'Diovan',    dosages: ['80mg', '160mg', '320mg'],       form: 'comprimido', category: 'Pressão arterial' },

  // ── Colesterol ──
  { name: 'Sinvastatina',     brand: 'Zocor',     dosages: ['10mg', '20mg', '40mg'],         form: 'comprimido', category: 'Colesterol' },
  { name: 'Atorvastatina',    brand: 'Lipitor',   dosages: ['10mg', '20mg', '40mg', '80mg'], form: 'comprimido', category: 'Colesterol' },
  { name: 'Rosuvastatina',    brand: 'Crestor',   dosages: ['5mg', '10mg', '20mg'],          form: 'comprimido', category: 'Colesterol' },

  // ── Diabetes ──
  { name: 'Metformina',       brand: 'Glifage',   dosages: ['500mg', '850mg', '1000mg'],     form: 'comprimido', category: 'Diabetes' },
  { name: 'Glibenclamida',    brand: 'Daonil',    dosages: ['5mg'],                          form: 'comprimido', category: 'Diabetes' },
  { name: 'Gliclazida',       brand: 'Diamicron', dosages: ['30mg', '60mg'],                 form: 'comprimido', category: 'Diabetes' },
  { name: 'Insulina NPH',     brand: 'Humulin N', dosages: ['100UI/mL'],                     form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina Regular', brand: 'Humulin R', dosages: ['100UI/mL'],                     form: 'líquido',    category: 'Diabetes' },
  { name: 'Empagliflozina',   brand: 'Jardiance', dosages: ['10mg', '25mg'],                 form: 'comprimido', category: 'Diabetes' },

  // ── Gastro ──
  { name: 'Omeprazol',        brand: 'Losec',     dosages: ['10mg', '20mg', '40mg'],         form: 'cápsula',    category: 'Gástrico' },
  { name: 'Pantoprazol',      brand: 'Pantozol',  dosages: ['20mg', '40mg'],                 form: 'comprimido', category: 'Gástrico' },
  { name: 'Esomeprazol',      brand: 'Nexium',    dosages: ['20mg', '40mg'],                 form: 'comprimido', category: 'Gástrico' },
  { name: 'Ranitidina',       brand: 'Antak',     dosages: ['150mg', '300mg'],               form: 'comprimido', category: 'Gástrico' },
  { name: 'Domperidona',      brand: 'Motilium',  dosages: ['10mg'],                         form: 'comprimido', category: 'Gástrico' },
  { name: 'Bromoprida',       brand: 'Digesan',   dosages: ['10mg', '4mg/mL'],               form: 'comprimido', category: 'Gástrico' },

  // ── Dor / Febre / Anti-inflamatório ──
  { name: 'Paracetamol',      brand: 'Tylenol',   dosages: ['500mg', '750mg', '200mg/mL'],   form: 'comprimido', category: 'Dor e febre' },
  { name: 'Dipirona',         brand: 'Novalgina', dosages: ['500mg', '1g', '500mg/mL'],      form: 'comprimido', category: 'Dor e febre' },
  { name: 'Ibuprofeno',       brand: 'Advil',     dosages: ['200mg', '400mg', '600mg'],      form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Nimesulida',       brand: 'Nisulid',   dosages: ['100mg'],                        form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Diclofenaco',      brand: 'Voltaren',  dosages: ['50mg', '75mg'],                 form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Naproxeno',        brand: 'Flanax',    dosages: ['250mg', '550mg'],               form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Ácido acetilsalicílico', brand: 'AAS', dosages: ['100mg', '500mg'],              form: 'comprimido', category: 'Antiagregante' },

  // ── Antibióticos ──
  { name: 'Amoxicilina',      brand: 'Amoxil',    dosages: ['250mg', '500mg', '875mg'],      form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Azitromicina',     brand: 'Zitromax',  dosages: ['500mg', '600mg/15mL'],          form: 'comprimido', category: 'Antibiótico' },
  { name: 'Cefalexina',       brand: 'Keflex',    dosages: ['500mg', '250mg/5mL'],           form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Ciprofloxacino',   brand: 'Cipro',     dosages: ['250mg', '500mg'],               form: 'comprimido', category: 'Antibiótico' },
  { name: 'Amoxicilina + Clavulanato', brand: 'Clavulin', dosages: ['500mg', '875mg'],       form: 'comprimido', category: 'Antibiótico' },
  { name: 'Metronidazol',     brand: 'Flagyl',    dosages: ['250mg', '400mg'],               form: 'comprimido', category: 'Antibiótico' },

  // ── Tireoide / Hormônios ──
  { name: 'Levotiroxina',     brand: 'Puran T4',  dosages: ['25mcg', '50mcg', '75mcg', '100mcg'], form: 'comprimido', category: 'Tireoide' },

  // ── Saúde mental / Neuro ──
  { name: 'Sertralina',       brand: 'Zoloft',    dosages: ['25mg', '50mg', '100mg'],        form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Fluoxetina',       brand: 'Prozac',    dosages: ['10mg', '20mg'],                 form: 'cápsula',    category: 'Antidepressivo' },
  { name: 'Escitalopram',     brand: 'Lexapro',   dosages: ['10mg', '15mg', '20mg'],         form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Amitriptilina',    brand: 'Tryptanol', dosages: ['25mg', '75mg'],                 form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Clonazepam',       brand: 'Rivotril',  dosages: ['0,5mg', '2mg', '2,5mg/mL'],     form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Alprazolam',       brand: 'Frontal',   dosages: ['0,25mg', '0,5mg', '1mg', '2mg'], form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Quetiapina',       brand: 'Seroquel',  dosages: ['25mg', '50mg', '100mg', '200mg'], form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Risperidona',      brand: 'Risperdal', dosages: ['1mg', '2mg', '3mg'],            form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Donepezila',       brand: 'Eranz',     dosages: ['5mg', '10mg'],                  form: 'comprimido', category: 'Alzheimer' },
  { name: 'Memantina',        brand: 'Ebix',      dosages: ['10mg', '20mg'],                 form: 'comprimido', category: 'Alzheimer' },
  { name: 'Levodopa + Carbidopa', brand: 'Prolopa', dosages: ['100mg', '250mg'],            form: 'comprimido', category: 'Parkinson' },

  // ── Respiratório / Alergia ──
  { name: 'Loratadina',       brand: 'Claritin',  dosages: ['10mg', '1mg/mL'],               form: 'comprimido', category: 'Antialérgico' },
  { name: 'Desloratadina',    brand: 'Desalex',   dosages: ['5mg', '0,5mg/mL'],              form: 'comprimido', category: 'Antialérgico' },
  { name: 'Cetirizina',       brand: 'Zyrtec',    dosages: ['10mg'],                         form: 'comprimido', category: 'Antialérgico' },
  { name: 'Salbutamol',       brand: 'Aerolin',   dosages: ['100mcg/dose'],                  form: 'outro',      category: 'Respiratório' },
  { name: 'Budesonida',       brand: 'Busonid',   dosages: ['200mcg', '400mcg'],             form: 'outro',      category: 'Respiratório' },
  { name: 'Prednisona',       brand: 'Meticorten',dosages: ['5mg', '20mg'],                  form: 'comprimido', category: 'Corticoide' },
  { name: 'Prednisolona',     brand: 'Predsim',   dosages: ['3mg/mL', '20mg'],               form: 'líquido',    category: 'Corticoide' },

  // ── Anticoagulante ──
  { name: 'Varfarina',        brand: 'Marevan',   dosages: ['1mg', '2,5mg', '5mg'],          form: 'comprimido', category: 'Anticoagulante' },
  { name: 'Rivaroxabana',     brand: 'Xarelto',   dosages: ['10mg', '15mg', '20mg'],         form: 'comprimido', category: 'Anticoagulante' },
  { name: 'Clopidogrel',      brand: 'Plavix',    dosages: ['75mg'],                         form: 'comprimido', category: 'Antiagregante' },

  // ── Vitaminas / Suplementos ──
  { name: 'Vitamina D',       brand: 'Addera D3', dosages: ['1000UI', '2000UI', '7000UI'],   form: 'comprimido', category: 'Vitamina' },
  { name: 'Vitamina B12',     brand: 'Cobavital', dosages: ['1000mcg'],                      form: 'comprimido', category: 'Vitamina' },
  { name: 'Ácido fólico',     brand: 'Folacin',   dosages: ['5mg'],                          form: 'comprimido', category: 'Vitamina' },
  { name: 'Sulfato ferroso',  brand: 'Noripurum', dosages: ['40mg', '109mg'],                form: 'comprimido', category: 'Suplemento' },
  { name: 'Cálcio + Vitamina D', brand: 'Caltrate', dosages: ['600mg+400UI'],               form: 'comprimido', category: 'Suplemento' },
  { name: 'Ômega 3',          brand: 'Naturalis', dosages: ['1000mg'],                       form: 'cápsula',    category: 'Suplemento' },
];

// Remove acentos para uma busca tolerante (ex: "acido" acha "ácido").
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const searchMedications = (query: string, limit = 20): CatalogMed[] => {
  const q = norm(query);
  if (!q) return MEDICATION_CATALOG.slice(0, limit);
  const scored = MEDICATION_CATALOG
    .map((m) => {
      const name = norm(m.name);
      const brand = norm(m.brand ?? '');
      const cat = norm(m.category);
      let score = -1;
      if (name.startsWith(q)) score = 0;
      else if (brand.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 2;
      else if (brand.includes(q)) score = 3;
      else if (cat.includes(q)) score = 4;
      return { m, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name));
  return scored.slice(0, limit).map((x) => x.m);
};
