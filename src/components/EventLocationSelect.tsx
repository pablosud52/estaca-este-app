import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { STAKE_UNITS } from '../data/stakeOrgStructure';

const OTHER_LOCATION_VALUE = '__OTRO__';

interface EventLocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  selectTestId?: string;
  inputTestId?: string;
  required?: boolean;
  variant?: 'light' | 'dark';
  showIcon?: boolean;
  selectClassName?: string;
  inputClassName?: string;
}

const VARIANT_STYLES = {
  light:
    'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600',
  dark:
    'border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500',
} as const;

/**
 * Selector de lugar del evento con las 7 unidades oficiales de la estaca
 * y la opción "Otro" para ingresar una ubicación manual.
 */
export const EventLocationSelect: React.FC<EventLocationSelectProps> = ({
  value,
  onChange,
  id,
  selectTestId,
  inputTestId,
  required = false,
  variant = 'light',
  showIcon = false,
  selectClassName,
  inputClassName,
}) => {
  const isKnownUnit = STAKE_UNITS.includes(value);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    () => Boolean(value.trim()) && !isKnownUnit
  );

  // Sincroniza el modo manual cuando se abre otro evento para editar
  useEffect(() => {
    if (!value.trim()) return;
    setIsCustomMode(!STAKE_UNITS.includes(value));
  }, [value]);

  const selectValue = isCustomMode
    ? OTHER_LOCATION_VALUE
    : isKnownUnit
    ? value
    : '';

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === OTHER_LOCATION_VALUE) {
      setIsCustomMode(true);
      if (STAKE_UNITS.includes(value)) {
        onChange('');
      }
      return;
    }
    setIsCustomMode(false);
    onChange(next);
  };

  const baseSelectClasses = `w-full ${
    showIcon ? 'pl-9 pr-3.5' : 'px-3.5'
  } py-2.5 rounded-xl border text-sm focus:outline-none ${VARIANT_STYLES[variant]}`;

  const baseInputClasses = `w-full ${
    showIcon ? 'pl-9 pr-3.5' : 'px-3.5'
  } py-2.5 rounded-xl border text-sm focus:outline-none ${VARIANT_STYLES[variant]}`;

  return (
    <div className="space-y-2">
      <div className="relative">
        {showIcon && (
          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        )}
        <select
          id={id}
          data-testid={selectTestId}
          required={required && !isCustomMode}
          value={selectValue}
          onChange={handleSelectChange}
          className={selectClassName ?? baseSelectClasses}
        >
          <option value="" disabled>
            Selecciona una unidad...
          </option>
          {STAKE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
          <option value={OTHER_LOCATION_VALUE}>Otro (ingresar manualmente)</option>
        </select>
      </div>

      {isCustomMode && (
        <div className="relative">
          {showIcon && (
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
          <input
            type="text"
            data-testid={inputTestId}
            required={required}
            placeholder="Escribe el lugar del evento..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClassName ?? baseInputClasses}
          />
        </div>
      )}
    </div>
  );
};
