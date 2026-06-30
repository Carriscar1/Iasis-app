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
  // ── Cardiovascular / Pressão arterial ──
  { name: 'Losartana',           brand: 'Cozaar',     dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Enalapril',           brand: 'Renitec',    dosages: ['5mg', '10mg', '20mg'],                 form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Captopril',           brand: 'Capoten',    dosages: ['12,5mg', '25mg', '50mg'],              form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Ramipril',            brand: 'Triatec',    dosages: ['2,5mg', '5mg', '10mg'],                form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Lisinopril',          brand: 'Zestril',    dosages: ['5mg', '10mg', '20mg'],                 form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Perindopril',         brand: 'Coversyl',   dosages: ['4mg', '5mg', '10mg'],                  form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Anlodipino',          brand: 'Norvasc',    dosages: ['2,5mg', '5mg', '10mg'],                form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Nifedipino',          brand: 'Adalat',     dosages: ['10mg', '20mg', '30mg', '60mg'],        form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Atenolol',            brand: 'Atenol',     dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Propranolol',         brand: 'Inderal',    dosages: ['10mg', '40mg', '80mg'],                form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Metoprolol',          brand: 'Selozok',    dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Bisoprolol',          brand: 'Concor',     dosages: ['1,25mg', '2,5mg', '5mg', '10mg'],      form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Carvedilol',          brand: 'Coreg',      dosages: ['3,125mg', '6,25mg', '12,5mg', '25mg'], form: 'comprimido', category: 'Cardíaco' },
  { name: 'Valsartana',          brand: 'Diovan',     dosages: ['80mg', '160mg', '320mg'],              form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Olmesartana',         brand: 'Benicar',    dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Candesartana',        brand: 'Atacand',    dosages: ['8mg', '16mg', '32mg'],                 form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Telmisartana',        brand: 'Micardis',   dosages: ['40mg', '80mg'],                        form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Irbesartana',         brand: 'Aprovel',    dosages: ['150mg', '300mg'],                      form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Metildopa',           brand: 'Aldomet',    dosages: ['250mg', '500mg'],                      form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Clonidina',           brand: 'Atensina',   dosages: ['0,100mg', '0,150mg', '0,200mg'],       form: 'comprimido', category: 'Pressão arterial' },
  { name: 'Espironolactona',     brand: 'Aldactone',  dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Diurético' },
  { name: 'Hidroclorotiazida',   brand: 'Clorana',    dosages: ['25mg', '50mg'],                        form: 'comprimido', category: 'Diurético' },
  { name: 'Clortalidona',        brand: 'Higroton',   dosages: ['12,5mg', '25mg', '50mg'],              form: 'comprimido', category: 'Diurético' },
  { name: 'Furosemida',          brand: 'Lasix',      dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Diurético' },
  { name: 'Indapamida',          brand: 'Natrilix',   dosages: ['1,5mg', '2,5mg'],                      form: 'comprimido', category: 'Diurético' },
  { name: 'Digoxina',            brand: 'Digoxina',   dosages: ['0,25mg'],                              form: 'comprimido', category: 'Cardíaco' },
  { name: 'Amiodarona',          brand: 'Ancoron',    dosages: ['100mg', '200mg'],                      form: 'comprimido', category: 'Cardíaco' },
  { name: 'Isossorbida',         brand: 'Monocordil', dosages: ['20mg', '40mg', '5mg sublingual'],      form: 'comprimido', category: 'Cardíaco' },

  // ── Colesterol / Triglicérides ──
  { name: 'Sinvastatina',        brand: 'Zocor',      dosages: ['10mg', '20mg', '40mg'],                form: 'comprimido', category: 'Colesterol' },
  { name: 'Atorvastatina',       brand: 'Lipitor',    dosages: ['10mg', '20mg', '40mg', '80mg'],        form: 'comprimido', category: 'Colesterol' },
  { name: 'Rosuvastatina',       brand: 'Crestor',    dosages: ['5mg', '10mg', '20mg', '40mg'],         form: 'comprimido', category: 'Colesterol' },
  { name: 'Pravastatina',        brand: 'Pravacol',   dosages: ['10mg', '20mg', '40mg'],                form: 'comprimido', category: 'Colesterol' },
  { name: 'Fluvastatina',        brand: 'Lescol',     dosages: ['20mg', '40mg', '80mg'],                form: 'comprimido', category: 'Colesterol' },
  { name: 'Ezetimiba',           brand: 'Zetia',      dosages: ['10mg'],                                form: 'comprimido', category: 'Colesterol' },
  { name: 'Ciprofibrato',        brand: 'Lipless',    dosages: ['100mg'],                               form: 'comprimido', category: 'Triglicérides' },
  { name: 'Fenofibrato',         brand: 'Lipidil',    dosages: ['160mg', '200mg', '250mg'],             form: 'cápsula',    category: 'Triglicérides' },
  { name: 'Genfibrozila',        brand: 'Lopid',      dosages: ['600mg', '900mg'],                      form: 'comprimido', category: 'Triglicérides' },

  // ── Diabetes ──
  { name: 'Metformina',          brand: 'Glifage',    dosages: ['500mg', '850mg', '1000mg'],            form: 'comprimido', category: 'Diabetes' },
  { name: 'Glibenclamida',       brand: 'Daonil',     dosages: ['5mg'],                                 form: 'comprimido', category: 'Diabetes' },
  { name: 'Glimepirida',         brand: 'Amaryl',     dosages: ['1mg', '2mg', '4mg'],                   form: 'comprimido', category: 'Diabetes' },
  { name: 'Gliclazida',          brand: 'Diamicron',  dosages: ['30mg', '60mg'],                        form: 'comprimido', category: 'Diabetes' },
  { name: 'Glipizida',           brand: 'Minidiab',   dosages: ['5mg'],                                 form: 'comprimido', category: 'Diabetes' },
  { name: 'Pioglitazona',        brand: 'Actos',      dosages: ['15mg', '30mg', '45mg'],                form: 'comprimido', category: 'Diabetes' },
  { name: 'Sitagliptina',        brand: 'Januvia',    dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Diabetes' },
  { name: 'Vildagliptina',       brand: 'Galvus',     dosages: ['50mg'],                                form: 'comprimido', category: 'Diabetes' },
  { name: 'Linagliptina',        brand: 'Trayenta',   dosages: ['5mg'],                                 form: 'comprimido', category: 'Diabetes' },
  { name: 'Saxagliptina',        brand: 'Onglyza',    dosages: ['2,5mg', '5mg'],                        form: 'comprimido', category: 'Diabetes' },
  { name: 'Empagliflozina',      brand: 'Jardiance',  dosages: ['10mg', '25mg'],                        form: 'comprimido', category: 'Diabetes' },
  { name: 'Dapagliflozina',      brand: 'Forxiga',    dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Diabetes' },
  { name: 'Canagliflozina',      brand: 'Invokana',   dosages: ['100mg', '300mg'],                      form: 'comprimido', category: 'Diabetes' },
  { name: 'Liraglutida',         brand: 'Victoza',    dosages: ['6mg/mL'],                              form: 'líquido',    category: 'Diabetes' },
  { name: 'Semaglutida',         brand: 'Ozempic',    dosages: ['0,25mg', '0,5mg', '1mg'],              form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina NPH',        brand: 'Humulin N',  dosages: ['100UI/mL'],                            form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina Regular',    brand: 'Humulin R',  dosages: ['100UI/mL'],                            form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina Glargina',   brand: 'Lantus',     dosages: ['100UI/mL'],                            form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina Lispro',     brand: 'Humalog',    dosages: ['100UI/mL'],                            form: 'líquido',    category: 'Diabetes' },
  { name: 'Insulina Asparte',    brand: 'NovoRapid',  dosages: ['100UI/mL'],                            form: 'líquido',    category: 'Diabetes' },

  // ── Gástrico / Digestivo ──
  { name: 'Omeprazol',           brand: 'Losec',      dosages: ['10mg', '20mg', '40mg'],                form: 'cápsula',    category: 'Gástrico' },
  { name: 'Pantoprazol',         brand: 'Pantozol',   dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Gástrico' },
  { name: 'Esomeprazol',         brand: 'Nexium',     dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Gástrico' },
  { name: 'Lansoprazol',         brand: 'Prazol',     dosages: ['15mg', '30mg'],                        form: 'cápsula',    category: 'Gástrico' },
  { name: 'Rabeprazol',          brand: 'Pariet',     dosages: ['10mg', '20mg'],                        form: 'comprimido', category: 'Gástrico' },
  { name: 'Ranitidina',          brand: 'Antak',      dosages: ['150mg', '300mg'],                      form: 'comprimido', category: 'Gástrico' },
  { name: 'Famotidina',          brand: 'Famox',      dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Gástrico' },
  { name: 'Domperidona',         brand: 'Motilium',   dosages: ['10mg', '1mg/mL'],                      form: 'comprimido', category: 'Gástrico' },
  { name: 'Bromoprida',          brand: 'Digesan',    dosages: ['10mg', '4mg/mL'],                      form: 'comprimido', category: 'Gástrico' },
  { name: 'Metoclopramida',      brand: 'Plasil',     dosages: ['10mg', '4mg/mL'],                      form: 'comprimido', category: 'Gástrico' },
  { name: 'Ondansetrona',        brand: 'Vonau',      dosages: ['4mg', '8mg'],                          form: 'comprimido', category: 'Antiemético' },
  { name: 'Simeticona',          brand: 'Luftal',     dosages: ['40mg', '125mg', '75mg/mL'],            form: 'comprimido', category: 'Digestivo' },
  { name: 'Hioscina',            brand: 'Buscopan',   dosages: ['10mg', '10mg+250mg'],                  form: 'comprimido', category: 'Antiespasmódico' },
  { name: 'Loperamida',          brand: 'Imosec',     dosages: ['2mg'],                                 form: 'comprimido', category: 'Antidiarreico' },
  { name: 'Lactulose',           brand: 'Lactulona',  dosages: ['667mg/mL'],                            form: 'líquido',    category: 'Laxante' },
  { name: 'Bisacodil',           brand: 'Dulcolax',   dosages: ['5mg'],                                 form: 'comprimido', category: 'Laxante' },
  { name: 'Mesalazina',          brand: 'Asalit',     dosages: ['400mg', '500mg', '800mg'],             form: 'comprimido', category: 'Gástrico' },

  // ── Dor / Febre / Anti-inflamatório ──
  { name: 'Paracetamol',         brand: 'Tylenol',    dosages: ['500mg', '750mg', '200mg/mL'],          form: 'comprimido', category: 'Dor e febre' },
  { name: 'Dipirona',            brand: 'Novalgina',  dosages: ['500mg', '1g', '500mg/mL'],             form: 'comprimido', category: 'Dor e febre' },
  { name: 'Ibuprofeno',          brand: 'Advil',      dosages: ['200mg', '400mg', '600mg'],             form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Nimesulida',          brand: 'Nisulid',    dosages: ['100mg', '50mg/mL'],                    form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Diclofenaco',         brand: 'Voltaren',   dosages: ['50mg', '75mg', '100mg'],               form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Naproxeno',           brand: 'Flanax',     dosages: ['250mg', '550mg'],                      form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Cetoprofeno',         brand: 'Profenid',   dosages: ['50mg', '100mg', '150mg'],              form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Meloxicam',           brand: 'Movatec',    dosages: ['7,5mg', '15mg'],                       form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Piroxicam',           brand: 'Feldene',    dosages: ['10mg', '20mg'],                        form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Cetorolaco',          brand: 'Toragesic',  dosages: ['10mg'],                                form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Celecoxibe',          brand: 'Celebra',    dosages: ['100mg', '200mg'],                      form: 'cápsula',    category: 'Anti-inflamatório' },
  { name: 'Etoricoxibe',         brand: 'Arcoxia',    dosages: ['60mg', '90mg', '120mg'],               form: 'comprimido', category: 'Anti-inflamatório' },
  { name: 'Ácido acetilsalicílico', brand: 'AAS',     dosages: ['100mg', '500mg'],                      form: 'comprimido', category: 'Antiagregante' },
  { name: 'Tramadol',            brand: 'Tramal',     dosages: ['50mg', '100mg', '100mg/mL'],           form: 'cápsula',    category: 'Analgésico opioide' },
  { name: 'Codeína',             brand: 'Codein',     dosages: ['30mg', '30mg+500mg'],                  form: 'comprimido', category: 'Analgésico opioide' },
  { name: 'Morfina',             brand: 'Dimorf',     dosages: ['10mg', '30mg', '10mg/mL'],             form: 'comprimido', category: 'Analgésico opioide' },
  { name: 'Ciclobenzaprina',     brand: 'Miosan',     dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Relaxante muscular' },
  { name: 'Orfenadrina',         brand: 'Dorflex',    dosages: ['35mg+300mg+50mg'],                     form: 'comprimido', category: 'Relaxante muscular' },
  { name: 'Carisoprodol',        brand: 'Mioflex',    dosages: ['125mg', '300mg'],                      form: 'comprimido', category: 'Relaxante muscular' },
  { name: 'Colchicina',          brand: 'Colchis',    dosages: ['0,5mg'],                               form: 'comprimido', category: 'Gota' },
  { name: 'Alopurinol',          brand: 'Zyloric',    dosages: ['100mg', '300mg'],                      form: 'comprimido', category: 'Gota' },

  // ── Antibióticos ──
  { name: 'Amoxicilina',         brand: 'Amoxil',     dosages: ['250mg', '500mg', '875mg'],             form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Amoxicilina + Clavulanato', brand: 'Clavulin', dosages: ['500mg', '875mg', '250mg/5mL'],     form: 'comprimido', category: 'Antibiótico' },
  { name: 'Ampicilina',          brand: 'Binotal',    dosages: ['500mg'],                               form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Azitromicina',        brand: 'Zitromax',   dosages: ['500mg', '600mg/15mL'],                 form: 'comprimido', category: 'Antibiótico' },
  { name: 'Claritromicina',      brand: 'Klaricid',   dosages: ['250mg', '500mg'],                      form: 'comprimido', category: 'Antibiótico' },
  { name: 'Eritromicina',        brand: 'Ilosone',    dosages: ['250mg', '500mg'],                      form: 'comprimido', category: 'Antibiótico' },
  { name: 'Cefalexina',          brand: 'Keflex',     dosages: ['500mg', '250mg/5mL'],                  form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Cefadroxila',         brand: 'Cefamox',    dosages: ['500mg', '250mg/5mL'],                  form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Cefuroxima',          brand: 'Zinnat',     dosages: ['250mg', '500mg'],                      form: 'comprimido', category: 'Antibiótico' },
  { name: 'Ciprofloxacino',      brand: 'Cipro',      dosages: ['250mg', '500mg'],                      form: 'comprimido', category: 'Antibiótico' },
  { name: 'Levofloxacino',       brand: 'Levaquin',   dosages: ['250mg', '500mg', '750mg'],             form: 'comprimido', category: 'Antibiótico' },
  { name: 'Norfloxacino',        brand: 'Floxacin',   dosages: ['400mg'],                               form: 'comprimido', category: 'Antibiótico' },
  { name: 'Sulfametoxazol + Trimetoprima', brand: 'Bactrim', dosages: ['400mg+80mg', '800mg+160mg'],    form: 'comprimido', category: 'Antibiótico' },
  { name: 'Metronidazol',        brand: 'Flagyl',     dosages: ['250mg', '400mg', '40mg/mL'],           form: 'comprimido', category: 'Antibiótico' },
  { name: 'Nitrofurantoína',     brand: 'Macrodantina', dosages: ['100mg'],                             form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Clindamicina',        brand: 'Dalacin',    dosages: ['150mg', '300mg'],                      form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Doxiciclina',         brand: 'Vibramicina', dosages: ['100mg'],                              form: 'comprimido', category: 'Antibiótico' },
  { name: 'Tetraciclina',        brand: 'Tetrex',     dosages: ['250mg', '500mg'],                      form: 'cápsula',    category: 'Antibiótico' },
  { name: 'Gentamicina',         brand: 'Garamicina', dosages: ['40mg/mL', '80mg'],                     form: 'líquido',    category: 'Antibiótico' },

  // ── Antifúngicos / Antivirais / Antiparasitários ──
  { name: 'Fluconazol',          brand: 'Zoltec',     dosages: ['100mg', '150mg'],                      form: 'cápsula',    category: 'Antifúngico' },
  { name: 'Itraconazol',         brand: 'Sporanox',   dosages: ['100mg'],                               form: 'cápsula',    category: 'Antifúngico' },
  { name: 'Cetoconazol',         brand: 'Nizoral',    dosages: ['200mg'],                               form: 'comprimido', category: 'Antifúngico' },
  { name: 'Nistatina',           brand: 'Micostatin', dosages: ['100.000UI/mL'],                        form: 'líquido',    category: 'Antifúngico' },
  { name: 'Terbinafina',         brand: 'Lamisil',    dosages: ['250mg'],                               form: 'comprimido', category: 'Antifúngico' },
  { name: 'Aciclovir',           brand: 'Zovirax',    dosages: ['200mg', '400mg'],                      form: 'comprimido', category: 'Antiviral' },
  { name: 'Valaciclovir',        brand: 'Valtrex',    dosages: ['500mg'],                               form: 'comprimido', category: 'Antiviral' },
  { name: 'Oseltamivir',         brand: 'Tamiflu',    dosages: ['30mg', '45mg', '75mg'],                form: 'cápsula',    category: 'Antiviral' },
  { name: 'Albendazol',          brand: 'Zentel',     dosages: ['400mg', '40mg/mL'],                    form: 'comprimido', category: 'Antiparasitário' },
  { name: 'Mebendazol',          brand: 'Pantelmin',  dosages: ['100mg', '500mg'],                      form: 'comprimido', category: 'Antiparasitário' },
  { name: 'Ivermectina',         brand: 'Revectina',  dosages: ['6mg'],                                 form: 'comprimido', category: 'Antiparasitário' },
  { name: 'Secnidazol',          brand: 'Secnidal',   dosages: ['500mg', '1000mg'],                     form: 'comprimido', category: 'Antiparasitário' },

  // ── Tireoide / Hormônios ──
  { name: 'Levotiroxina',        brand: 'Puran T4',   dosages: ['25mcg', '50mcg', '75mcg', '100mcg'],   form: 'comprimido', category: 'Tireoide' },
  { name: 'Metimazol',           brand: 'Tapazol',    dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Tireoide' },
  { name: 'Propiltiouracila',    brand: 'Propiltiouracila', dosages: ['100mg'],                         form: 'comprimido', category: 'Tireoide' },
  { name: 'Prednisona',          brand: 'Meticorten', dosages: ['5mg', '20mg'],                         form: 'comprimido', category: 'Corticoide' },
  { name: 'Prednisolona',        brand: 'Predsim',    dosages: ['3mg/mL', '20mg'],                      form: 'líquido',    category: 'Corticoide' },
  { name: 'Dexametasona',        brand: 'Decadron',   dosages: ['0,5mg', '4mg', '0,1mg/mL'],            form: 'comprimido', category: 'Corticoide' },
  { name: 'Betametasona',        brand: 'Celestone',  dosages: ['0,5mg', '0,5mg/mL'],                   form: 'comprimido', category: 'Corticoide' },
  { name: 'Hidrocortisona',      brand: 'Solu-Cortef', dosages: ['100mg', '500mg'],                     form: 'outro',      category: 'Corticoide' },
  { name: 'Estradiol',           brand: 'Primogyna',  dosages: ['1mg', '2mg'],                          form: 'comprimido', category: 'Hormônio' },
  { name: 'Testosterona',        brand: 'Durateston', dosages: ['250mg/mL'],                            form: 'líquido',    category: 'Hormônio' },

  // ── Anticoncepcionais ──
  { name: 'Etinilestradiol + Levonorgestrel', brand: 'Microvlar', dosages: ['0,03mg+0,15mg'],          form: 'comprimido', category: 'Anticoncepcional' },
  { name: 'Etinilestradiol + Drospirenona', brand: 'Yasmin',     dosages: ['0,03mg+3mg'],              form: 'comprimido', category: 'Anticoncepcional' },
  { name: 'Etinilestradiol + Gestodeno', brand: 'Tâmisa',        dosages: ['0,02mg+0,075mg'],          form: 'comprimido', category: 'Anticoncepcional' },
  { name: 'Desogestrel',         brand: 'Cerazette',  dosages: ['0,075mg'],                             form: 'comprimido', category: 'Anticoncepcional' },
  { name: 'Levonorgestrel',      brand: 'Pílula do dia seguinte', dosages: ['1,5mg'],                   form: 'comprimido', category: 'Anticoncepcional' },

  // ── Saúde mental / Neuro ──
  { name: 'Sertralina',          brand: 'Zoloft',     dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Fluoxetina',          brand: 'Prozac',     dosages: ['10mg', '20mg'],                        form: 'cápsula',    category: 'Antidepressivo' },
  { name: 'Escitalopram',        brand: 'Lexapro',    dosages: ['10mg', '15mg', '20mg'],                form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Citalopram',          brand: 'Cipramil',   dosages: ['20mg', '40mg'],                        form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Paroxetina',          brand: 'Aropax',     dosages: ['10mg', '20mg', '30mg'],                form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Venlafaxina',         brand: 'Efexor',     dosages: ['37,5mg', '75mg', '150mg'],             form: 'cápsula',    category: 'Antidepressivo' },
  { name: 'Desvenlafaxina',      brand: 'Pristiq',    dosages: ['50mg', '100mg'],                       form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Duloxetina',          brand: 'Cymbalta',   dosages: ['30mg', '60mg'],                        form: 'cápsula',    category: 'Antidepressivo' },
  { name: 'Bupropiona',          brand: 'Wellbutrin', dosages: ['150mg', '300mg'],                      form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Amitriptilina',       brand: 'Tryptanol',  dosages: ['25mg', '75mg'],                        form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Nortriptilina',       brand: 'Pamelor',    dosages: ['10mg', '25mg', '50mg', '75mg'],        form: 'cápsula',    category: 'Antidepressivo' },
  { name: 'Imipramina',          brand: 'Tofranil',   dosages: ['10mg', '25mg'],                        form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Mirtazapina',         brand: 'Remeron',    dosages: ['15mg', '30mg', '45mg'],                form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Trazodona',           brand: 'Donaren',    dosages: ['50mg', '100mg', '150mg'],              form: 'comprimido', category: 'Antidepressivo' },
  { name: 'Clonazepam',          brand: 'Rivotril',   dosages: ['0,5mg', '2mg', '2,5mg/mL'],            form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Alprazolam',          brand: 'Frontal',    dosages: ['0,25mg', '0,5mg', '1mg', '2mg'],       form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Diazepam',            brand: 'Valium',     dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Lorazepam',           brand: 'Lorax',      dosages: ['1mg', '2mg'],                          form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Bromazepam',          brand: 'Lexotan',    dosages: ['3mg', '6mg'],                          form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Clobazam',            brand: 'Frisium',    dosages: ['10mg', '20mg'],                        form: 'comprimido', category: 'Ansiolítico' },
  { name: 'Zolpidem',            brand: 'Stilnox',    dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Indutor do sono' },
  { name: 'Quetiapina',          brand: 'Seroquel',   dosages: ['25mg', '50mg', '100mg', '200mg'],      form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Risperidona',         brand: 'Risperdal',  dosages: ['1mg', '2mg', '3mg'],                   form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Olanzapina',          brand: 'Zyprexa',    dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Aripiprazol',         brand: 'Abilify',    dosages: ['10mg', '15mg', '20mg'],                form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Haloperidol',         brand: 'Haldol',     dosages: ['1mg', '5mg', '2mg/mL'],                form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Clorpromazina',       brand: 'Amplictil',  dosages: ['25mg', '100mg'],                       form: 'comprimido', category: 'Psiquiátrico' },
  { name: 'Lítio',               brand: 'Carbolitium', dosages: ['300mg'],                              form: 'comprimido', category: 'Estabilizador de humor' },
  { name: 'Valproato de sódio',  brand: 'Depakene',   dosages: ['250mg', '500mg', '50mg/mL'],           form: 'comprimido', category: 'Estabilizador de humor' },
  { name: 'Lamotrigina',         brand: 'Lamictal',   dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Estabilizador de humor' },
  { name: 'Carbamazepina',       brand: 'Tegretol',   dosages: ['200mg', '400mg', '20mg/mL'],           form: 'comprimido', category: 'Anticonvulsivante' },
  { name: 'Fenitoína',           brand: 'Hidantal',   dosages: ['100mg'],                               form: 'comprimido', category: 'Anticonvulsivante' },
  { name: 'Fenobarbital',        brand: 'Gardenal',   dosages: ['100mg', '40mg/mL'],                    form: 'comprimido', category: 'Anticonvulsivante' },
  { name: 'Gabapentina',         brand: 'Neurontin',  dosages: ['300mg', '400mg', '600mg'],             form: 'cápsula',    category: 'Neuropático' },
  { name: 'Pregabalina',         brand: 'Lyrica',     dosages: ['75mg', '150mg', '300mg'],              form: 'cápsula',    category: 'Neuropático' },
  { name: 'Levetiracetam',       brand: 'Keppra',     dosages: ['250mg', '500mg', '1000mg'],            form: 'comprimido', category: 'Anticonvulsivante' },
  { name: 'Donepezila',          brand: 'Eranz',      dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Alzheimer' },
  { name: 'Memantina',           brand: 'Ebix',       dosages: ['10mg', '20mg'],                        form: 'comprimido', category: 'Alzheimer' },
  { name: 'Rivastigmina',        brand: 'Exelon',     dosages: ['1,5mg', '3mg', '4,5mg', '6mg'],        form: 'cápsula',    category: 'Alzheimer' },
  { name: 'Galantamina',         brand: 'Reminyl',    dosages: ['8mg', '16mg', '24mg'],                 form: 'cápsula',    category: 'Alzheimer' },
  { name: 'Levodopa + Carbidopa', brand: 'Prolopa',   dosages: ['100mg', '250mg'],                      form: 'comprimido', category: 'Parkinson' },
  { name: 'Pramipexol',          brand: 'Sifrol',     dosages: ['0,125mg', '0,25mg', '1mg'],            form: 'comprimido', category: 'Parkinson' },
  { name: 'Biperideno',          brand: 'Akineton',   dosages: ['2mg', '4mg'],                          form: 'comprimido', category: 'Parkinson' },
  { name: 'Metilfenidato',       brand: 'Ritalina',   dosages: ['10mg', '20mg', '30mg', '40mg'],        form: 'comprimido', category: 'TDAH' },
  { name: 'Lisdexanfetamina',    brand: 'Venvanse',   dosages: ['30mg', '50mg', '70mg'],                form: 'cápsula',    category: 'TDAH' },
  { name: 'Sumatriptana',        brand: 'Sumax',      dosages: ['50mg', '100mg'],                       form: 'comprimido', category: 'Enxaqueca' },
  { name: 'Flunarizina',         brand: 'Vertix',     dosages: ['10mg'],                                form: 'comprimido', category: 'Enxaqueca' },
  { name: 'Topiramato',          brand: 'Topamax',    dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Enxaqueca' },
  { name: 'Betaistina',          brand: 'Labirin',    dosages: ['16mg', '24mg'],                        form: 'comprimido', category: 'Vertigem' },

  // ── Respiratório / Alergia ──
  { name: 'Loratadina',          brand: 'Claritin',   dosages: ['10mg', '1mg/mL'],                      form: 'comprimido', category: 'Antialérgico' },
  { name: 'Desloratadina',       brand: 'Desalex',    dosages: ['5mg', '0,5mg/mL'],                     form: 'comprimido', category: 'Antialérgico' },
  { name: 'Cetirizina',          brand: 'Zyrtec',     dosages: ['10mg', '1mg/mL'],                      form: 'comprimido', category: 'Antialérgico' },
  { name: 'Levocetirizina',      brand: 'Zyxem',      dosages: ['5mg'],                                 form: 'comprimido', category: 'Antialérgico' },
  { name: 'Fexofenadina',        brand: 'Allegra',    dosages: ['60mg', '120mg', '180mg'],              form: 'comprimido', category: 'Antialérgico' },
  { name: 'Hidroxizina',         brand: 'Hixizine',   dosages: ['25mg', '2mg/mL'],                      form: 'comprimido', category: 'Antialérgico' },
  { name: 'Dexclorfeniramina',   brand: 'Polaramine', dosages: ['2mg', '0,4mg/mL'],                     form: 'comprimido', category: 'Antialérgico' },
  { name: 'Prometazina',         brand: 'Fenergan',   dosages: ['25mg'],                                form: 'comprimido', category: 'Antialérgico' },
  { name: 'Salbutamol',          brand: 'Aerolin',    dosages: ['100mcg/dose', '2mg/5mL'],              form: 'outro',      category: 'Respiratório' },
  { name: 'Fenoterol',           brand: 'Berotec',    dosages: ['100mcg/dose', '5mg/mL'],               form: 'outro',      category: 'Respiratório' },
  { name: 'Budesonida',          brand: 'Busonid',    dosages: ['200mcg', '400mcg'],                    form: 'outro',      category: 'Respiratório' },
  { name: 'Beclometasona',       brand: 'Clenil',     dosages: ['50mcg', '250mcg'],                     form: 'outro',      category: 'Respiratório' },
  { name: 'Formoterol + Budesonida', brand: 'Alenia', dosages: ['6mcg+200mcg', '12mcg+400mcg'],         form: 'outro',      category: 'Respiratório' },
  { name: 'Salmeterol + Fluticasona', brand: 'Seretide', dosages: ['25mcg+125mcg', '25mcg+250mcg'],     form: 'outro',      category: 'Respiratório' },
  { name: 'Ipratrópio',          brand: 'Atrovent',   dosages: ['0,25mg/mL', '0,02mg/dose'],            form: 'outro',      category: 'Respiratório' },
  { name: 'Montelucaste',        brand: 'Singulair',  dosages: ['4mg', '5mg', '10mg'],                  form: 'comprimido', category: 'Respiratório' },
  { name: 'Acebrofilina',        brand: 'Brondilat',  dosages: ['10mg/mL', '25mg/5mL'],                 form: 'líquido',    category: 'Respiratório' },
  { name: 'Ambroxol',            brand: 'Mucosolvan', dosages: ['30mg', '3mg/mL', '6mg/mL'],            form: 'líquido',    category: 'Expectorante' },
  { name: 'Acetilcisteína',      brand: 'Fluimucil',  dosages: ['200mg', '600mg', '20mg/mL'],           form: 'outro',      category: 'Expectorante' },
  { name: 'Bromexina',           brand: 'Bisolvon',   dosages: ['8mg', '4mg/5mL'],                      form: 'comprimido', category: 'Expectorante' },
  { name: 'Dropropizina',        brand: 'Notuss',     dosages: ['1,5mg/mL', '3mg/mL'],                  form: 'líquido',    category: 'Antitussígeno' },

  // ── Anticoagulante / Antiagregante ──
  { name: 'Varfarina',           brand: 'Marevan',    dosages: ['1mg', '2,5mg', '5mg'],                 form: 'comprimido', category: 'Anticoagulante' },
  { name: 'Rivaroxabana',        brand: 'Xarelto',    dosages: ['10mg', '15mg', '20mg'],                form: 'comprimido', category: 'Anticoagulante' },
  { name: 'Apixabana',           brand: 'Eliquis',    dosages: ['2,5mg', '5mg'],                        form: 'comprimido', category: 'Anticoagulante' },
  { name: 'Dabigatrana',         brand: 'Pradaxa',    dosages: ['75mg', '110mg', '150mg'],              form: 'cápsula',    category: 'Anticoagulante' },
  { name: 'Enoxaparina',         brand: 'Clexane',    dosages: ['20mg', '40mg', '60mg'],                form: 'líquido',    category: 'Anticoagulante' },
  { name: 'Clopidogrel',         brand: 'Plavix',     dosages: ['75mg'],                                form: 'comprimido', category: 'Antiagregante' },
  { name: 'Ticagrelor',          brand: 'Brilinta',   dosages: ['90mg'],                                form: 'comprimido', category: 'Antiagregante' },

  // ── Vitaminas / Suplementos ──
  { name: 'Vitamina D',          brand: 'Addera D3',  dosages: ['1000UI', '2000UI', '7000UI', '50000UI'], form: 'comprimido', category: 'Vitamina' },
  { name: 'Vitamina C',          brand: 'Cebion',     dosages: ['500mg', '1g', '200mg/mL'],             form: 'comprimido', category: 'Vitamina' },
  { name: 'Vitamina B12',        brand: 'Cobavital',  dosages: ['1000mcg'],                             form: 'comprimido', category: 'Vitamina' },
  { name: 'Complexo B',          brand: 'Citoneurin', dosages: ['B1+B6+B12'],                           form: 'comprimido', category: 'Vitamina' },
  { name: 'Vitamina B6',         brand: 'Piridoxina', dosages: ['40mg'],                                form: 'comprimido', category: 'Vitamina' },
  { name: 'Ácido fólico',        brand: 'Folacin',    dosages: ['0,4mg', '5mg'],                        form: 'comprimido', category: 'Vitamina' },
  { name: 'Vitamina A',          brand: 'Arovit',     dosages: ['50000UI'],                             form: 'cápsula',    category: 'Vitamina' },
  { name: 'Vitamina E',          brand: 'Ephynal',    dosages: ['400mg'],                               form: 'cápsula',    category: 'Vitamina' },
  { name: 'Vitamina K',          brand: 'Kanakion',   dosages: ['10mg/mL'],                             form: 'líquido',    category: 'Vitamina' },
  { name: 'Sulfato ferroso',     brand: 'Noripurum',  dosages: ['40mg', '109mg', '25mg/mL'],            form: 'comprimido', category: 'Suplemento' },
  { name: 'Cálcio + Vitamina D',  brand: 'Caltrate',  dosages: ['600mg+400UI'],                         form: 'comprimido', category: 'Suplemento' },
  { name: 'Carbonato de cálcio', brand: 'Os-Cal',     dosages: ['500mg', '600mg'],                      form: 'comprimido', category: 'Suplemento' },
  { name: 'Magnésio',            brand: 'Magneson',   dosages: ['250mg', '300mg'],                      form: 'comprimido', category: 'Suplemento' },
  { name: 'Cloreto de potássio', brand: 'Slow-K',     dosages: ['600mg'],                               form: 'comprimido', category: 'Suplemento' },
  { name: 'Zinco',               brand: 'Zinco Quelato', dosages: ['7mg', '20mg'],                       form: 'comprimido', category: 'Suplemento' },
  { name: 'Ômega 3',             brand: 'Naturalis',  dosages: ['1000mg'],                              form: 'cápsula',    category: 'Suplemento' },
  { name: 'Colágeno',            brand: 'Mais Colágeno', dosages: ['10g'],                               form: 'outro',      category: 'Suplemento' },
  { name: 'Glucosamina + Condroitina', brand: 'Artrolive', dosages: ['1500mg+1200mg'],                  form: 'cápsula',    category: 'Articulações' },

  // ── Olhos / Ouvido / Pele ──
  { name: 'Colírio lubrificante', brand: 'Lacrima',   dosages: ['5mg/mL'],                              form: 'líquido',    category: 'Oftálmico' },
  { name: 'Tobramicina (colírio)', brand: 'Tobrex',   dosages: ['3mg/mL'],                              form: 'líquido',    category: 'Oftálmico' },
  { name: 'Maleato de timolol (colírio)', brand: 'Timoptol', dosages: ['2,5mg/mL', '5mg/mL'],           form: 'líquido',    category: 'Oftálmico' },
  { name: 'Cetoconazol (creme)', brand: 'Candicort',  dosages: ['20mg/g'],                              form: 'outro',      category: 'Dermatológico' },
  { name: 'Permetrina',          brand: 'Keltrina',   dosages: ['50mg/mL'],                             form: 'líquido',    category: 'Dermatológico' },
  { name: 'Isotretinoína',       brand: 'Roacutan',   dosages: ['10mg', '20mg'],                        form: 'cápsula',    category: 'Dermatológico' },

  // ── Urologia ──
  { name: 'Tansulosina',         brand: 'Secotex',    dosages: ['0,4mg'],                               form: 'cápsula',    category: 'Próstata' },
  { name: 'Finasterida',         brand: 'Proscar',    dosages: ['1mg', '5mg'],                          form: 'comprimido', category: 'Próstata' },
  { name: 'Doxazosina',          brand: 'Carduran',   dosages: ['2mg', '4mg'],                          form: 'comprimido', category: 'Próstata' },
  { name: 'Sildenafila',         brand: 'Viagra',     dosages: ['25mg', '50mg', '100mg'],               form: 'comprimido', category: 'Disfunção erétil' },
  { name: 'Tadalafila',          brand: 'Cialis',     dosages: ['5mg', '20mg'],                         form: 'comprimido', category: 'Disfunção erétil' },
  { name: 'Oxibutinina',         brand: 'Retemic',    dosages: ['5mg', '10mg'],                         form: 'comprimido', category: 'Bexiga' },
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

// Lista de categorias únicas (para filtros/estatística no app).
export const MEDICATION_CATEGORIES: string[] = Array.from(
  new Set(MEDICATION_CATALOG.map((m) => m.category)),
).sort((a, b) => a.localeCompare(b));

// Catálogo inteiro em ordem alfabética (para rolar a lista completa).
export const MEDICATIONS_ALPHABETICAL: CatalogMed[] = [...MEDICATION_CATALOG].sort(
  (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
);
