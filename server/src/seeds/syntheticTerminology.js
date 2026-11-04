import { Term } from '../models/Term.js';
import { logger } from '../utils/logger.js';

/**
 * Synthetic MedDRA-like and WHO-Drug-like Medical Terminology Dataset
 *
 * NOTE: This is purely synthetic / fictional medical terminology created for
 * clinical pharmacovigilance simulation. It contains NO proprietary dictionary data.
 *
 * Hierarchy: SOC > HLGT > HLT > PT > LLT + Synthetic WHO-Drug
 */

export function buildSyntheticTerminology() {
  const dictionaryVersion = 'SYN-MedDRA-27.0';

  const socDefinitions = [
    {
      code: 'SOC-1001',
      name: 'Gastrointestinal disorders',
      hlgts: [
        {
          code: 'HLGT-2001',
          name: 'Gastrointestinal signs and symptoms',
          hlts: [
            {
              code: 'HLT-3001',
              name: 'Nausea and vomiting symptoms',
              pts: [
                {
                  code: 'PT-4001',
                  name: 'Nausea',
                  llts: ['Feeling queasy', 'Nauseousness', 'Sickness in stomach', 'Motion queasiness'],
                },
                {
                  code: 'PT-4002',
                  name: 'Vomiting',
                  llts: ['Emesis', 'Vomiting episodes', 'Dry heaving', 'Retching'],
                },
                {
                  code: 'PT-4003',
                  name: 'Regurgitation',
                  llts: ['Acid regurgitation', 'Food regurgitation', 'Esophageal reflux'],
                },
              ],
            },
            {
              code: 'HLT-3002',
              name: 'Abdominal pain and discomfort',
              pts: [
                {
                  code: 'PT-4004',
                  name: 'Abdominal pain upper',
                  llts: ['Epigastric distress', 'Stomach ache', 'Upper gastric tenderness', 'Gastric ache'],
                },
                {
                  code: 'PT-4005',
                  name: 'Abdominal cramp',
                  llts: ['Intestinal spasm', 'Stomach cramping', 'Bowel colic'],
                },
                {
                  code: 'PT-4006',
                  name: 'Dyspepsia',
                  llts: ['Indigestion', 'Bloated upper stomach', 'Heartburn sensation'],
                },
              ],
            },
          ],
        },
        {
          code: 'HLGT-2002',
          name: 'Gastrointestinal motility and defaecation conditions',
          hlts: [
            {
              code: 'HLT-3003',
              name: 'Diarrhoeal disorders',
              pts: [
                {
                  code: 'PT-4007',
                  name: 'Diarrhoea',
                  llts: ['Loose stools', 'Watery diarrhoea', 'Frequent loose bowel', 'Bowel urgency'],
                },
                {
                  code: 'PT-4008',
                  name: 'Gastroenteritis',
                  llts: ['Stomach flu', 'Enteric inflammation', 'Viral gastroenteritis'],
                },
              ],
            },
            {
              code: 'HLT-3004',
              name: 'Constipation and hard bowel',
              pts: [
                {
                  code: 'PT-4009',
                  name: 'Constipation',
                  llts: ['Hard stools', 'Infrequent bowel movement', 'Bowel obstipation'],
                },
                {
                  code: 'PT-4010',
                  name: 'Flatulence',
                  llts: ['Gas bloating', 'Excessive flatus', 'Abdominal distension'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1002',
      name: 'Nervous system disorders',
      hlgts: [
        {
          code: 'HLGT-2003',
          name: 'Headaches and cranial sensations',
          hlts: [
            {
              code: 'HLT-3005',
              name: 'Headaches NEC',
              pts: [
                {
                  code: 'PT-4011',
                  name: 'Headache',
                  llts: ['Tension headache', 'Cephalgia', 'Frontal head pain', 'Bitemporal throbbing'],
                },
                {
                  code: 'PT-4012',
                  name: 'Migraine',
                  llts: ['Migraine with aura', 'Hemicrania', 'Ophthalmic migraine', 'Sick headache'],
                },
                {
                  code: 'PT-4013',
                  name: 'Sinus headache',
                  llts: ['Facial pressure ache', 'Sinus frontal ache'],
                },
              ],
            },
          ],
        },
        {
          code: 'HLGT-2004',
          name: 'Neurological disturbance and coordination',
          hlts: [
            {
              code: 'HLT-3006',
              name: 'Disturbances in consciousness and equilibrium',
              pts: [
                {
                  code: 'PT-4014',
                  name: 'Dizziness',
                  llts: ['Lightheadedness', 'Giddiness', 'Head swimming', 'Disequilibrium'],
                },
                {
                  code: 'PT-4015',
                  name: 'Somnolence',
                  llts: ['Excessive daytime drowsiness', 'Sedation', 'Heavy sleepiness'],
                },
                {
                  code: 'PT-4016',
                  name: 'Syncope',
                  llts: ['Fainting attack', 'Vasovagal episode', 'Transient loss of consciousness', 'Blackout'],
                },
                {
                  code: 'PT-4017',
                  name: 'Vertigo',
                  llts: ['Rotational vertigo', 'Spinning sensation', 'Labyrinthine dizziness'],
                },
              ],
            },
            {
              code: 'HLT-3007',
              name: 'Movement and involuntary tremors',
              pts: [
                {
                  code: 'PT-4018',
                  name: 'Tremor',
                  llts: ['Hand shaking', 'Action tremor', 'Finger trembling', 'Fine kinetic tremor'],
                },
                {
                  code: 'PT-4019',
                  name: 'Muscle spasms',
                  llts: ['Twitching involuntary', 'Muscle cramps', 'Myoclonus'],
                },
                {
                  code: 'PT-4020',
                  name: 'Paresthesia',
                  llts: ['Pins and needles', 'Tingling sensation in digits', 'Numbness and tingling'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1003',
      name: 'Cardiac disorders',
      hlgts: [
        {
          code: 'HLGT-2005',
          name: 'Cardiac arrhythmias and rate variations',
          hlts: [
            {
              code: 'HLT-3008',
              name: 'Rate and rhythm disorders NEC',
              pts: [
                {
                  code: 'PT-4021',
                  name: 'Tachycardia',
                  llts: ['Rapid heartbeat', 'Heart racing', 'Pulse rate elevated', 'Sinus tachycardia'],
                },
                {
                  code: 'PT-4022',
                  name: 'Palpitations',
                  llts: ['Heart pounding', 'Awareness of heart beats', 'Fluttering pulse'],
                },
                {
                  code: 'PT-4023',
                  name: 'Bradycardia',
                  llts: ['Slow heart rate', 'Low pulse rate', 'Sinus bradycardia'],
                },
                {
                  code: 'PT-4024',
                  name: 'Atrial fibrillation',
                  llts: ['Irregular heart rhythm', 'Auricular fibrillation', 'AFib episode'],
                },
              ],
            },
          ],
        },
        {
          code: 'HLGT-2006',
          name: 'Coronary artery and ischemic conditions',
          hlts: [
            {
              code: 'HLT-3009',
              name: 'Ischemic myocardial signs',
              pts: [
                {
                  code: 'PT-4025',
                  name: 'Angina pectoris',
                  llts: ['Chest tightness cardiac', 'Precordial constriction', 'Substernal pressure'],
                },
                {
                  code: 'PT-4026',
                  name: 'Myocardial infarction',
                  llts: ['Heart attack', 'Acute coronary syndrome', 'Myocardial necrosis'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1004',
      name: 'Vascular disorders',
      hlgts: [
        {
          code: 'HLGT-2007',
          name: 'Vascular blood pressure disorders',
          hlts: [
            {
              code: 'HLT-3010',
              name: 'Hypotensive conditions',
              pts: [
                {
                  code: 'PT-4027',
                  name: 'Hypotension',
                  llts: ['Low blood pressure', 'Orthostatic drop', 'Postural dizziness drop'],
                },
                {
                  code: 'PT-4028',
                  name: 'Circulatory collapse',
                  llts: ['Vascular collapse', 'Hypovolemic state'],
                },
              ],
            },
            {
              code: 'HLT-3011',
              name: 'Hypertensive conditions',
              pts: [
                {
                  code: 'PT-4029',
                  name: 'Hypertension',
                  llts: ['High blood pressure', 'Blood pressure spike', 'Arterial hypertension'],
                },
                {
                  code: 'PT-4030',
                  name: 'Flushing',
                  llts: ['Facial erythema vascular', 'Hot flushes', 'Skin reddening'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1005',
      name: 'Skin and subcutaneous tissue disorders',
      hlgts: [
        {
          code: 'HLGT-2008',
          name: 'Epidermal and dermal eruptions',
          hlts: [
            {
              code: 'HLT-3012',
              name: 'Rashes, eruptions and exanthems',
              pts: [
                {
                  code: 'PT-4031',
                  name: 'Rash',
                  llts: ['Skin rash', 'Maculopapular rash', 'Erythematous eruption', 'Exanthem skin'],
                },
                {
                  code: 'PT-4032',
                  name: 'Pruritus',
                  llts: ['Skin itching', 'Severe pruritic sensation', 'Itchy skin generalized'],
                },
                {
                  code: 'PT-4033',
                  name: 'Urticaria',
                  llts: ['Hives', 'Nettle rash', 'Welts cutaneous', 'Urticarial wheals'],
                },
                {
                  code: 'PT-4034',
                  name: 'Dermatitis allergic',
                  llts: ['Contact rash', 'Eczema flare', 'Allergic skin reaction'],
                },
              ],
            },
            {
              code: 'HLT-3013',
              name: 'Bullous and severe cutaneous conditions',
              pts: [
                {
                  code: 'PT-4035',
                  name: 'Erythema multiforme',
                  llts: ['Target lesions cutaneous', 'Bullous multiforme'],
                },
                {
                  code: 'PT-4036',
                  name: 'Toxic epidermal necrolysis',
                  llts: ['Skin sloughing syndrome', 'Epidermal detachment acute'],
                },
                {
                  code: 'PT-4037',
                  name: 'Alopecia',
                  llts: ['Hair thinning', 'Hair loss generalized', 'Patchy balding'],
                },
                {
                  code: 'PT-4038',
                  name: 'Dry skin',
                  llts: ['Xerosis', 'Rough flaky skin'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1006',
      name: 'Respiratory, thoracic and mediastinal disorders',
      hlgts: [
        {
          code: 'HLGT-2009',
          name: 'Respiratory tract and thoracic conditions',
          hlts: [
            {
              code: 'HLT-3014',
              name: 'Breathing abnormalities and dyspnoea',
              pts: [
                {
                  code: 'PT-4039',
                  name: 'Dyspnoea',
                  llts: ['Shortness of breath', 'Breathlessness', 'Difficulty breathing', 'Air hunger'],
                },
                {
                  code: 'PT-4040',
                  name: 'Cough',
                  llts: ['Dry persistent cough', 'Productive hacking cough', 'Irritative cough'],
                },
                {
                  code: 'PT-4041',
                  name: 'Wheezing',
                  llts: ['Expiratory wheeze', 'Audible chest whistling'],
                },
                {
                  code: 'PT-4042',
                  name: 'Bronchospasm',
                  llts: ['Acute airway constriction', 'Bronchial spasm'],
                },
              ],
            },
            {
              code: 'HLT-3015',
              name: 'Upper respiratory signs',
              pts: [
                {
                  code: 'PT-4043',
                  name: 'Epistaxis',
                  llts: ['Nosebleed', 'Nasal hemorrhage'],
                },
                {
                  code: 'PT-4044',
                  name: 'Nasal congestion',
                  llts: ['Stuffy nose', 'Rhinorrhoea', 'Sinus blockage'],
                },
                {
                  code: 'PT-4045',
                  name: 'Pharyngitis',
                  llts: ['Sore throat', 'Throat irritation', 'Pharyngeal pain'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1007',
      name: 'General disorders and administration site conditions',
      hlgts: [
        {
          code: 'HLGT-2010',
          name: 'General and systemic signs',
          hlts: [
            {
              code: 'HLT-3016',
              name: 'Febrile disorders and temperature regulation',
              pts: [
                {
                  code: 'PT-4046',
                  name: 'Pyrexia',
                  llts: ['Fever', 'High body temperature', 'Hyperthermia', 'Febrile elevation'],
                },
                {
                  code: 'PT-4047',
                  name: 'Chills',
                  llts: ['Rigors', 'Shivering with cold', 'Cold shivering spell'],
                },
              ],
            },
            {
              code: 'HLT-3017',
              name: 'Asthenic and fatigue conditions',
              pts: [
                {
                  code: 'PT-4048',
                  name: 'Fatigue',
                  llts: ['Extreme tiredness', 'Exhaustion', 'Lethargy', 'Heavy fatigue'],
                },
                {
                  code: 'PT-4049',
                  name: 'Malaise',
                  llts: ['Feeling poorly', 'General unwellness', 'Bodily discomfort'],
                },
                {
                  code: 'PT-4050',
                  name: 'Asthenia',
                  llts: ['Loss of bodily strength', 'Generalized weakness', 'Debility'],
                },
                {
                  code: 'PT-4051',
                  name: 'Peripheral edema',
                  llts: ['Swollen ankles', 'Pedal edema', 'Puffy extremities'],
                },
              ],
            },
          ],
        },
        {
          code: 'HLGT-2011',
          name: 'Administration and injection site events',
          hlts: [
            {
              code: 'HLT-3018',
              name: 'Injection and infusion site reactions',
              pts: [
                {
                  code: 'PT-4052',
                  name: 'Injection site pain',
                  llts: ['Puncture site tenderness', 'Needle pain localized', 'Injection sting'],
                },
                {
                  code: 'PT-4053',
                  name: 'Injection site erythema',
                  llts: ['Redness at injection spot', 'Local dermal flare'],
                },
                {
                  code: 'PT-4054',
                  name: 'Injection site swelling',
                  llts: ['Local puncture swelling', 'Administration lump'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1008',
      name: 'Immune system disorders',
      hlgts: [
        {
          code: 'HLGT-2012',
          name: 'Allergic conditions and hypersensitivities',
          hlts: [
            {
              code: 'HLT-3019',
              name: 'Anaphylaxis and acute hypersensitivity',
              pts: [
                {
                  code: 'PT-4055',
                  name: 'Anaphylactic reaction',
                  llts: ['Anaphylaxis acute', 'Allergic shock episode', 'Severe hypersensitivity attack'],
                },
                {
                  code: 'PT-4056',
                  name: 'Angioedema',
                  llts: ['Facial swelling allergic', 'Lip and eyelid edema', 'Laryngeal swelling'],
                },
                {
                  code: 'PT-4057',
                  name: 'Drug hypersensitivity',
                  llts: ['Allergic reaction to medicine', 'Adverse drug allergy'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1009',
      name: 'Hepatobiliary and renal disorders',
      hlgts: [
        {
          code: 'HLGT-2013',
          name: 'Hepatobiliary and hepatic functions',
          hlts: [
            {
              code: 'HLT-3020',
              name: 'Hepatic enzyme and bilirubin disturbances',
              pts: [
                {
                  code: 'PT-4058',
                  name: 'Alanine aminotransferase increased',
                  llts: ['Elevated ALT', 'Liver transaminase raised', 'High serum ALT'],
                },
                {
                  code: 'PT-4059',
                  name: 'Jaundice',
                  llts: ['Yellowing of sclera', 'Icterus', 'Bilirubin staining'],
                },
                {
                  code: 'PT-4060',
                  name: 'Hepatotoxicity',
                  llts: ['Toxic liver injury', 'Drug induced liver impairment'],
                },
              ],
            },
          ],
        },
        {
          code: 'HLGT-2014',
          name: 'Renal and urinary tract disorders',
          hlts: [
            {
              code: 'HLT-3021',
              name: 'Renal impairment conditions',
              pts: [
                {
                  code: 'PT-4061',
                  name: 'Acute kidney injury',
                  llts: ['Acute renal failure', 'Creatinine elevation', 'Decreased renal clearance'],
                },
                {
                  code: 'PT-4062',
                  name: 'Dysuria',
                  llts: ['Painful urination', 'Burning during micturition'],
                },
                {
                  code: 'PT-4063',
                  name: 'Hematuria',
                  llts: ['Blood in urine', 'Microscopic hematuria'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: 'SOC-1010',
      name: 'Psychiatric and sleep disorders',
      hlgts: [
        {
          code: 'HLGT-2015',
          name: 'Mood, anxiety and sleep disturbances',
          hlts: [
            {
              code: 'HLT-3022',
              name: 'Sleep disorders and disturbances',
              pts: [
                {
                  code: 'PT-4064',
                  name: 'Insomnia',
                  llts: ['Inability to sleep', 'Sleeplessness', 'Frequent awakening nocturnal'],
                },
                {
                  code: 'PT-4065',
                  name: 'Nightmares',
                  llts: ['Disturbing dreams', 'Sleep terrors'],
                },
              ],
            },
            {
              code: 'HLT-3023',
              name: 'Anxiety and affective symptoms',
              pts: [
                {
                  code: 'PT-4066',
                  name: 'Anxiety',
                  llts: ['Nervous tension', 'Apprehension acute', 'Panic feelings'],
                },
                {
                  code: 'PT-4067',
                  name: 'Agitation',
                  llts: ['Motor restlessness', 'Extreme irritability'],
                },
                {
                  code: 'PT-4068',
                  name: 'Depressed mood',
                  llts: ['Sadness persistent', 'Low spirits', 'Affective depression'],
                },
                {
                  code: 'PT-4069',
                  name: 'Confusion',
                  llts: ['Disorientation acute', 'Mental fog', 'Confusional episode'],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  // Synthetic WHO-Drug-like medicinal substances
  const syntheticWhoDrugs = [
    { code: 'DRUG-9001', name: 'Amoxiclav Synth 625mg', drugCategory: 'Antibacterial / Penicillin' },
    { code: 'DRUG-9002', name: 'NeuroCalm Synth 10mg', drugCategory: 'Anxiolytic / Benzodiazepine derivative' },
    { code: 'DRUG-9003', name: 'CardioVas Synth 20mg', drugCategory: 'ACE Inhibitor / Antihypertensive' },
    { code: 'DRUG-9004', name: 'CardioVas Synth 40mg', drugCategory: 'ACE Inhibitor / Antihypertensive' },
    { code: 'DRUG-9005', name: 'GlucoReg Synth 500mg', drugCategory: 'Biguanide / Antidiabetic' },
    { code: 'DRUG-9006', name: 'GlucoReg Synth 1000mg', drugCategory: 'Biguanide / Antidiabetic' },
    { code: 'DRUG-9007', name: 'AnalgoMax Synth 500mg', drugCategory: 'NSAID / Analgesic' },
    { code: 'DRUG-9008', name: 'RespiraClear Synth Inhaler', drugCategory: 'Beta-2 agonist / Bronchodilator' },
    { code: 'DRUG-9009', name: 'GastroShield Synth 40mg', drugCategory: 'Proton Pump Inhibitor' },
    { code: 'DRUG-9010', name: 'OncoTarget Synth 50mg', drugCategory: 'Tyrosine kinase inhibitor / Antineoplastic' },
    { code: 'DRUG-9011', name: 'LipidoStat Synth 20mg', drugCategory: 'HMG-CoA reductase inhibitor / Statin' },
    { code: 'DRUG-9012', name: 'ViroStat Synth 400mg', drugCategory: 'Antiviral nucleotide analogue' },
    { code: 'DRUG-9013', name: 'ThyroBalance Synth 100mcg', drugCategory: 'Thyroid hormone replacement' },
    { code: 'DRUG-9014', name: 'ImmunoSuppress Synth 5mg', drugCategory: 'Calcineurin inhibitor / Immunosuppressant' },
    { code: 'DRUG-9015', name: 'SedatoNox Synth 10mg', drugCategory: 'Hypnotic / Non-benzodiazepine' },
    { code: 'DRUG-9016', name: 'ArthroEase Synth 200mg', drugCategory: 'COX-2 selective inhibitor' },
    { code: 'DRUG-9017', name: 'DermaCure Synth 1% Cream', drugCategory: 'Topical corticosteroid' },
    { code: 'DRUG-9018', name: 'ClotAway Synth 75mg', drugCategory: 'Antiplatelet agent' },
    { code: 'DRUG-9019', name: 'OcuClear Synth Drops', drugCategory: 'Ophthalmic prostaglandin analogue' },
    { code: 'DRUG-9020', name: 'Diurex Synth 25mg', drugCategory: 'Thiazide diuretic' },
  ];

  const terms = [];
  let lltCounter = 5001;

  for (const soc of socDefinitions) {
    terms.push({
      code: soc.code,
      name: soc.name,
      level: 'SOC',
      parentCodes: [],
      dictionaryVersion,
      hierarchy: [{ level: 'SOC', code: soc.code, name: soc.name }],
    });

    for (const hlgt of soc.hlgts) {
      terms.push({
        code: hlgt.code,
        name: hlgt.name,
        level: 'HLGT',
        parentCodes: [soc.code],
        dictionaryVersion,
        hierarchy: [
          { level: 'SOC', code: soc.code, name: soc.name },
          { level: 'HLGT', code: hlgt.code, name: hlgt.name },
        ],
      });

      for (const hlt of hlgt.hlts) {
        terms.push({
          code: hlt.code,
          name: hlt.name,
          level: 'HLT',
          parentCodes: [hlgt.code],
          dictionaryVersion,
          hierarchy: [
            { level: 'SOC', code: soc.code, name: soc.name },
            { level: 'HLGT', code: hlgt.code, name: hlgt.name },
            { level: 'HLT', code: hlt.code, name: hlt.name },
          ],
        });

        for (const pt of hlt.pts) {
          terms.push({
            code: pt.code,
            name: pt.name,
            level: 'PT',
            parentCodes: [hlt.code],
            dictionaryVersion,
            hierarchy: [
              { level: 'SOC', code: soc.code, name: soc.name },
              { level: 'HLGT', code: hlgt.code, name: hlgt.name },
              { level: 'HLT', code: hlt.code, name: hlt.name },
              { level: 'PT', code: pt.code, name: pt.name },
            ],
          });

          for (const lltName of pt.llts) {
            const lltCode = `LLT-${lltCounter++}`;
            terms.push({
              code: lltCode,
              name: lltName,
              level: 'LLT',
              parentCodes: [pt.code],
              dictionaryVersion,
              hierarchy: [
                { level: 'SOC', code: soc.code, name: soc.name },
                { level: 'HLGT', code: hlgt.code, name: hlgt.name },
                { level: 'HLT', code: hlt.code, name: hlt.name },
                { level: 'PT', code: pt.code, name: pt.name },
                { level: 'LLT', code: lltCode, name: lltName },
              ],
            });
          }
        }
      }
    }
  }

  for (const drug of syntheticWhoDrugs) {
    terms.push({
      code: drug.code,
      name: drug.name,
      level: 'DRUG',
      drugCategory: drug.drugCategory,
      parentCodes: [],
      dictionaryVersion,
      hierarchy: [{ level: 'DRUG', code: drug.code, name: `${drug.name} (${drug.drugCategory})` }],
    });
  }

  return terms;
}

/**
 * Seeds the synthetic terminology database with terms and parent-child hierarchy references.
 */
export async function seedSyntheticTerminology() {
  const termsData = buildSyntheticTerminology();
  const existingCount = await Term.countDocuments();

  if (existingCount >= termsData.length) {
    return existingCount;
  }

  // 1. Bulk upsert terms by code
  const operations = termsData.map((t) => ({
    updateOne: {
      filter: { code: t.code },
      update: {
        $set: {
          code: t.code,
          name: t.name,
          level: t.level,
          dictionaryVersion: t.dictionaryVersion,
          hierarchy: t.hierarchy,
          drugCategory: t.drugCategory || '',
        },
      },
      upsert: true,
    },
  }));

  await Term.bulkWrite(operations);

  // 2. Fetch all saved terms to map code -> _id
  const allTerms = await Term.find({}).select('code _id').lean();
  const codeToId = new Map(allTerms.map((t) => [t.code, t._id]));

  // 3. Update parentIds on each term
  const parentUpdates = termsData
    .filter((t) => t.parentCodes && t.parentCodes.length > 0)
    .map((t) => {
      const parentIds = t.parentCodes
        .map((pCode) => codeToId.get(pCode))
        .filter(Boolean);

      return {
        updateOne: {
          filter: { code: t.code },
          update: { $set: { parentIds } },
        },
      };
    });

  if (parentUpdates.length > 0) {
    await Term.bulkWrite(parentUpdates);
  }

  const finalCount = await Term.countDocuments();
  logger.info(`✓ Seeded ${finalCount} synthetic terminology entries (MedDRA hierarchy & WHO-Drug)`);
  return finalCount;
}
