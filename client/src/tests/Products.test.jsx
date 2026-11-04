import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import Products from '../pages/Products';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 13: Products Catalogue Page & Detail Drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockProducts = [
    {
      _id: 'prod-01',
      productCode: 'PRD-0001',
      name: 'CardioMax 50mg',
      genericName: 'Metoprolol Succinate',
      strength: '50mg',
      dosageForm: 'Tablet',
      route: 'Oral',
      manufacturer: 'PharmaCorp Labs',
      classification: 'Prescription',
      status: 'ACTIVE',
      identifiers: { atcCode: 'C07AB02', ndc: '0001-0002-03' },
      ingredients: [{ name: 'Metoprolol', strength: '50mg' }],
      usageCount: 3,
    },
    {
      _id: 'prod-02',
      productCode: 'PRD-0002',
      name: 'NeuroCalm 10mg',
      genericName: 'Diazepam',
      strength: '10mg',
      dosageForm: 'Capsule',
      route: 'Oral',
      manufacturer: 'BioMed AG',
      classification: 'Prescription',
      status: 'RETIRED',
      identifiers: { atcCode: 'N05BA01', ndc: '' },
      ingredients: [{ name: 'Diazepam', strength: '10mg' }],
      usageCount: 1,
    },
  ];

  it('renders product catalogue table with usage count and status pills', async () => {
    api.get.mockResolvedValue({
      data: {
        success: true,
        products: mockProducts,
      },
    });

    render(<Products />);

    expect(screen.getByText(/Medicinal Product Catalogue/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('CardioMax 50mg')).toBeDefined();
      expect(screen.getByText('Metoprolol Succinate')).toBeDefined();
      expect(screen.getByText('NeuroCalm 10mg')).toBeDefined();
      expect(screen.getByText('PRD-0001')).toBeDefined();
      expect(screen.getByText('PRD-0002')).toBeDefined();
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
      expect(screen.getAllByText('RETIRED').length).toBeGreaterThan(0);
    });
  });

  it('opens product detail drawer displaying specifications, ingredients, and linked cases', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/products/prod-01')) {
        return Promise.resolve({
          data: {
            success: true,
            product: mockProducts[0],
            usageCount: 3,
            linkedCases: [
              { _id: 'case-1', caseNumber: 'PV-2026-0001', status: 'medical_review', seriousness: 'Serious' },
              { _id: 'case-2', caseNumber: 'PV-2026-0002', status: 'closed', seriousness: 'Non-Serious' },
            ],
          },
        });
      }
      return Promise.resolve({
        data: { success: true, products: mockProducts },
      });
    });

    render(<Products />);

    await waitFor(() => {
      expect(screen.getAllByText('View')[0]).toBeDefined();
    });

    // Click View on first product
    fireEvent.click(screen.getAllByText('View')[0]);

    await waitFor(() => {
      expect(screen.getByText(/Pharmaceutical Specifications/i)).toBeDefined();
      expect(screen.getAllByText(/Active Ingredients/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Safety Cases Linked to this Product \(3\)/i)).toBeDefined();
      expect(screen.getByText('PV-2026-0001')).toBeDefined();
      expect(screen.getByText('PV-2026-0002')).toBeDefined();
    });
  });

  it('allows retiring an active product with audit justification', async () => {
    api.get.mockResolvedValue({
      data: { success: true, products: mockProducts },
    });

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        product: { ...mockProducts[0], status: 'RETIRED' },
        message: 'Product retired successfully',
      },
    });

    render(<Products />);

    await waitFor(() => {
      expect(screen.getByText('Retire')).toBeDefined();
    });

    // Click Retire
    fireEvent.click(screen.getByText('Retire'));

    await waitFor(() => {
      expect(screen.getByText(/Retire Product from Active Formulary/i)).toBeDefined();
      expect(screen.getByText(/Audit Compliance Guarantee:/i)).toBeDefined();
    });

    // Fill retirement reason
    const reasonInput = screen.getByPlaceholderText(/Market withdrawal, superseded by reformulation/i);
    fireEvent.change(reasonInput, { target: { value: 'Formula superseded by CardioMax XR' } });

    // Confirm retirement
    const confirmBtn = screen.getByText(/Confirm Retirement/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/products/prod-01/retire',
        expect.objectContaining({
          reason: 'Formula superseded by CardioMax XR',
        })
      );
    });
  });
});
