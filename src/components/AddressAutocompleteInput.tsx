import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface AddressAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

const formatPhotonAddress = (props: NonNullable<PhotonFeature['properties']>): string => {
  const streetPart = props.street
    ? [props.street, props.housenumber].filter(Boolean).join(' ')
    : props.name || '';
  const cityPart = props.city || props.state || props.county || '';
  if (streetPart && cityPart && !streetPart.toLowerCase().includes(cityPart.toLowerCase())) {
    return `${streetPart}, ${cityPart}`;
  }
  return streetPart || cityPart;
};

/** Campo de dirección con sugerencias gratuitas de OpenStreetMap (Photon) enfocadas en Uruguay. */
export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'Ej: Av. Italia 4452, Montevideo',
  required = false,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const query = value.trim();
    if (query.length < 4) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          `${query}, Uruguay`
        )}&limit=5&lat=-34.9011&lon=-56.1645&lang=es`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { features?: PhotonFeature[] };
        const formatted = (data.features || [])
          .filter((f) => !f.properties?.countrycode || f.properties.countrycode === 'UY')
          .map((f) => (f.properties ? formatPhotonAddress(f.properties) : ''))
          .filter(Boolean);
        const unique = Array.from(new Set(formatted));
        setSuggestions(unique);
        setIsOpen(unique.length > 0);
      } catch {
        // Silencioso si no hay conexión o se canceló la consulta
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, isFocused]);

  const handleSelect = (addr: string) => {
    skipNextFetchRef.current = true;
    onChange(addr);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          setTimeout(() => setIsOpen(false), 150);
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />

      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-lg max-h-48 overflow-y-auto py-1"
        >
          {suggestions.map((addr) => (
            <li key={addr}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(addr);
                }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{addr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
