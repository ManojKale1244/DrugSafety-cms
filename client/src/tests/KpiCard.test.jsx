import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KpiCard from '../components/dashboard/KpiCard';
import { FolderOpen } from 'lucide-react';

describe('KpiCard Component', () => {
  it('renders title, value, subtitle, and delta correctly', () => {
    render(
      <KpiCard
        title="Total Cases"
        value={42}
        subtitle="All active reports"
        delta="+14%"
        icon={FolderOpen}
        colorScheme="blue"
      />,
    );

    expect(screen.getByText('Total Cases')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('All active reports')).toBeDefined();
    expect(screen.getByText('+14%')).toBeDefined();
  });

  it('triggers click handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <KpiCard
        title="Overdue Actions"
        value={5}
        icon={FolderOpen}
        onClick={handleClick}
      />,
    );

    fireEvent.click(screen.getByText('Overdue Actions'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
