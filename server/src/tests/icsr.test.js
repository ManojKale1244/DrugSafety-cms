import { describe, it, expect } from 'vitest';
import {
  validateIcsr,
  caseToIcsr,
  icsrToCase,
  parseIcsrXml,
  buildIcsrXml,
  SYNTHETIC_E2B_NOTICE,
} from '../services/icsrMapper.service.js';

describe('Module 11: ICSR / E2B Mapper and Validation Service', () => {
  const sampleCase = {
    caseNumber: 'CASE-2026-9901',
    receiptDate: new Date('2026-03-10'),
    country: 'India',
    serious: true,
    patient: {
      reference: 'PT-001',
      age: 45,
      ageUnit: 'years',
      sex: 'Male',
      weight: 70,
    },
    reporter: {
      name: 'Dr. John Watson',
      qualification: 'Physician',
      country: 'India',
      contact: 'drwatson@hospital.org',
    },
    caseProducts: [
      {
        productName: 'CardioMax 50mg',
        role: 'Suspect',
        dose: '50mg',
        frequency: 'Daily',
        route: 'Oral',
        indication: 'Hypertension',
      },
    ],
    reactions: [
      {
        verbatim: 'Severe palpitations and flushing',
        pt: 'Palpitations',
        soc: 'Cardiac disorders',
        meddraCode: '10033557',
        outcome: 'recovering',
        causality: 'Probable',
      },
    ],
    narrative: 'Patient developed sudden palpitations 2 hours after first dose of CardioMax.',
  };

  const sampleAssessment = {
    seriousnessCriteria: ['hospitalization', 'medically_important'],
    medicalComment: 'Clinical review confirms plausible temporal relationship.',
  };

  it('exports a Case to synthetic E2B JSON format with valid schema and disclaimer notice', () => {
    const result = caseToIcsr(sampleCase, sampleAssessment, 'JSON');

    expect(result.format).toBe('JSON');
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors.length).toBe(0);

    const parsed = JSON.parse(result.payload);
    expect(parsed.ichicsr).toBeDefined();
    expect(parsed.ichicsr.ichicsrmessageheader.messagetype).toBe('ichicsr');
    expect(parsed.ichicsr.ichicsrmessageheader.syntheticNotice).toBe(SYNTHETIC_E2B_NOTICE);
    expect(parsed.ichicsr.safetyreport.safetyreportid).toBe('CASE-2026-9901');
    expect(parsed.ichicsr.safetyreport.patient.patientinitial).toBe('PT-001');
    expect(parsed.ichicsr.safetyreport.patient.patientsex).toBe(1); // Male
    expect(parsed.ichicsr.safetyreport.products.product[0].medicinalproduct).toBe('CardioMax 50mg');
    expect(parsed.ichicsr.safetyreport.reactions.reaction[0].reactionmeddrapt).toBe('Palpitations');
    expect(parsed.ichicsr.safetyreport.seriousnesscriteria.hospitalization).toBe(1);
  });

  it('exports a Case to synthetic E2B XML format containing XML declaration and educational comment', () => {
    const result = caseToIcsr(sampleCase, sampleAssessment, 'XML');

    expect(result.format).toBe('XML');
    expect(result.payload).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.payload).toContain('Successful export ≠ regulatory compliance.');
    expect(result.payload).toContain('<safetyreportid>CASE-2026-9901</safetyreportid>');
    expect(result.payload).toContain('<medicinalproduct>CardioMax 50mg</medicinalproduct>');
    expect(result.payload).toContain('<reactionmeddrapt>Palpitations</reactionmeddrapt>');
  });

  it('validates synthetic E2B schema and returns structured path + message errors for missing fields', () => {
    const invalidPayload = {
      ichicsr: {
        ichicsrmessageheader: {
          // Missing messagetype, messagesenderidentifier, etc.
        },
        safetyreport: {
          // Missing patient, reporter, products, reactions
        },
      },
    };

    const validation = validateIcsr(invalidPayload);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    const paths = validation.errors.map((e) => e.path);
    expect(paths).toContain('header.messagetype');
    expect(paths).toContain('safetyreport.primarysource');
    expect(paths).toContain('safetyreport.patient');
    expect(paths).toContain('safetyreport.products');
    expect(paths).toContain('safetyreport.reactions');

    // Each error must have path and human-readable message
    validation.errors.forEach((err) => {
      expect(typeof err.path).toBe('string');
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(5);
    });
  });

  it('parses inbound XML and builds clean intake payload mapping', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ichicsr>
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messagesenderidentifier>HA-GATEWAY</messagesenderidentifier>
    <messagereceiveridentifier>SPONSOR-SAFETY</messagereceiveridentifier>
    <messagedate>20260310</messagedate>
  </ichicsrmessageheader>
  <safetyreport>
    <safetyreportid>REG-2026-0044</safetyreportid>
    <receiptdate>2026-03-09</receiptdate>
    <primarysource>
      <reportername>Dr. Sarah Connor</reportername>
      <qualification>Physician</qualification>
      <reportercountry>India</reportercountry>
    </primarysource>
    <patient>
      <patientinitial>JD</patientinitial>
      <patientonsetage>52</patientonsetage>
      <patientonsetageunit>years</patientonsetageunit>
      <patientsex>1</patientsex>
    </patient>
    <products>
      <product>
        <drugcharacterization>1</drugcharacterization>
        <medicinalproduct>Aspirin Plus 100mg</medicinalproduct>
      </product>
    </products>
    <reactions>
      <reaction>
        <reactionverbatim>Gastric bleeding</reactionverbatim>
        <reactionmeddrapt>Gastrointestinal haemorrhage</reactionmeddrapt>
      </reaction>
    </reactions>
    <summary>
      <narrativeincludeclinical>Patient experienced acute gastric bleeding following daily Aspirin administration.</narrativeincludeclinical>
    </summary>
  </safetyreport>
</ichicsr>`;

    const parsed = parseIcsrXml(xml);
    const validation = validateIcsr(parsed);
    expect(validation.valid).toBe(true);

    const intakeData = icsrToCase(parsed);
    expect(intakeData.reporter.name).toBe('Dr. Sarah Connor');
    expect(intakeData.patient.reference).toBe('JD');
    expect(intakeData.patient.age).toBe(52);
    expect(intakeData.patient.sex).toBe('Male');
    expect(intakeData.suspectedProduct).toBe('Aspirin Plus 100mg');
    expect(intakeData.reportedReaction).toBe('Gastrointestinal haemorrhage');
    expect(intakeData.narrative).toContain('acute gastric bleeding');
  });

  it('builds XML from JS object and round-trips correctly', () => {
    const original = {
      ichicsr: {
        ichicsrmessageheader: {
          messagetype: 'ichicsr',
          messagesenderidentifier: 'SENDER',
          messagereceiveridentifier: 'RECEIVER',
          messagedate: '20260310',
        },
        safetyreport: {
          safetyreportid: 'SR-1234',
          primarysource: { reportername: 'Jane Doe' },
          patient: { patientinitial: 'PT' },
          products: [{ drugcharacterization: 1, medicinalproduct: 'DrugX' }],
          reactions: [{ reactionmeddrapt: 'Headache' }],
        },
      },
    };

    const xml = buildIcsrXml(original);
    expect(xml).toContain('<safetyreportid>SR-1234</safetyreportid>');

    const parsed = parseIcsrXml(xml);
    expect(parsed.ichicsr.safetyreport.safetyreportid).toBe('SR-1234');
  });
});

