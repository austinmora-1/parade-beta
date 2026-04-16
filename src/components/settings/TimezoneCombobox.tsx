import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Globe, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const TIMEZONE_OPTIONS = [
  { group: 'US & Canada', zones: [
    { value: 'America/New_York', label: 'Eastern Time (ET)', keywords: 'new york boston philadelphia miami atlanta' },
    { value: 'America/Chicago', label: 'Central Time (CT)', keywords: 'chicago houston dallas austin' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', keywords: 'denver boulder salt lake' },
    { value: 'America/Phoenix', label: 'Arizona (no DST)', keywords: 'phoenix scottsdale tucson' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', keywords: 'los angeles san francisco seattle portland' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)', keywords: 'anchorage fairbanks juneau' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', keywords: 'honolulu maui' },
    { value: 'America/Toronto', label: 'Eastern - Toronto', keywords: 'toronto montreal ottawa' },
    { value: 'America/Vancouver', label: 'Pacific - Vancouver', keywords: 'vancouver victoria' },
    { value: 'America/Edmonton', label: 'Mountain - Edmonton', keywords: 'edmonton calgary' },
    { value: 'America/Winnipeg', label: 'Central - Winnipeg', keywords: 'winnipeg' },
    { value: 'America/Halifax', label: 'Atlantic - Halifax', keywords: 'halifax nova scotia' },
    { value: 'America/St_Johns', label: 'Newfoundland (NT)', keywords: 'st johns newfoundland' },
    { value: 'America/Regina', label: 'Saskatchewan (no DST)', keywords: 'regina saskatoon' },
  ]},
  { group: 'Europe', zones: [
    { value: 'Europe/London', label: 'London (GMT/BST)', keywords: 'london uk england britain' },
    { value: 'Europe/Paris', label: 'Paris (CET)', keywords: 'paris france' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)', keywords: 'berlin germany munich' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)', keywords: 'amsterdam netherlands' },
    { value: 'Europe/Rome', label: 'Rome (CET)', keywords: 'rome italy milan' },
    { value: 'Europe/Madrid', label: 'Madrid (CET)', keywords: 'madrid barcelona spain' },
    { value: 'Europe/Lisbon', label: 'Lisbon (WET)', keywords: 'lisbon portugal' },
    { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)', keywords: 'dublin ireland' },
    { value: 'Europe/Zurich', label: 'Zurich (CET)', keywords: 'zurich geneva switzerland' },
    { value: 'Europe/Vienna', label: 'Vienna (CET)', keywords: 'vienna austria' },
    { value: 'Europe/Brussels', label: 'Brussels (CET)', keywords: 'brussels belgium' },
    { value: 'Europe/Stockholm', label: 'Stockholm (CET)', keywords: 'stockholm sweden' },
    { value: 'Europe/Oslo', label: 'Oslo (CET)', keywords: 'oslo norway' },
    { value: 'Europe/Copenhagen', label: 'Copenhagen (CET)', keywords: 'copenhagen denmark' },
    { value: 'Europe/Helsinki', label: 'Helsinki (EET)', keywords: 'helsinki finland' },
    { value: 'Europe/Prague', label: 'Prague (CET)', keywords: 'prague czech' },
    { value: 'Europe/Warsaw', label: 'Warsaw (CET)', keywords: 'warsaw poland' },
    { value: 'Europe/Budapest', label: 'Budapest (CET)', keywords: 'budapest hungary' },
    { value: 'Europe/Bucharest', label: 'Bucharest (EET)', keywords: 'bucharest romania' },
    { value: 'Europe/Athens', label: 'Athens (EET)', keywords: 'athens greece' },
    { value: 'Europe/Istanbul', label: 'Istanbul (TRT)', keywords: 'istanbul turkey' },
    { value: 'Europe/Moscow', label: 'Moscow (MSK)', keywords: 'moscow russia st petersburg' },
    { value: 'Europe/Kiev', label: 'Kyiv (EET)', keywords: 'kyiv kiev ukraine' },
  ]},
  { group: 'Asia & Pacific', zones: [
    { value: 'Asia/Dubai', label: 'Dubai (GST)', keywords: 'dubai abu dhabi uae' },
    { value: 'Asia/Kolkata', label: 'India (IST)', keywords: 'mumbai delhi bangalore india' },
    { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', keywords: 'bangkok thailand' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', keywords: 'singapore' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', keywords: 'hong kong' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', keywords: 'shanghai beijing china' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', keywords: 'tokyo japan osaka' },
    { value: 'Asia/Seoul', label: 'Seoul (KST)', keywords: 'seoul korea' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)', keywords: 'sydney melbourne australia' },
    { value: 'Australia/Perth', label: 'Perth (AWST)', keywords: 'perth australia' },
    { value: 'Australia/Adelaide', label: 'Adelaide (ACST)', keywords: 'adelaide australia' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)', keywords: 'auckland new zealand' },
    { value: 'Pacific/Fiji', label: 'Fiji (FJT)', keywords: 'fiji' },
    { value: 'Asia/Taipei', label: 'Taipei (CST)', keywords: 'taipei taiwan' },
    { value: 'Asia/Manila', label: 'Manila (PHT)', keywords: 'manila philippines' },
    { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', keywords: 'jakarta indonesia' },
    { value: 'Asia/Karachi', label: 'Karachi (PKT)', keywords: 'karachi pakistan' },
    { value: 'Asia/Dhaka', label: 'Dhaka (BST)', keywords: 'dhaka bangladesh' },
    { value: 'Asia/Riyadh', label: 'Riyadh (AST)', keywords: 'riyadh saudi arabia' },
    { value: 'Asia/Tehran', label: 'Tehran (IRST)', keywords: 'tehran iran' },
  ]},
  { group: 'Americas', zones: [
    { value: 'America/Mexico_City', label: 'Mexico City (CST)', keywords: 'mexico city' },
    { value: 'America/Bogota', label: 'Bogotá (COT)', keywords: 'bogota colombia' },
    { value: 'America/Lima', label: 'Lima (PET)', keywords: 'lima peru' },
    { value: 'America/Santiago', label: 'Santiago (CLT)', keywords: 'santiago chile' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires (ART)', keywords: 'buenos aires argentina' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)', keywords: 'sao paulo brazil rio' },
    { value: 'America/Caracas', label: 'Caracas (VET)', keywords: 'caracas venezuela' },
    { value: 'America/Montevideo', label: 'Montevideo (UYT)', keywords: 'montevideo uruguay' },
  ]},
  { group: 'Africa & Middle East', zones: [
    { value: 'Africa/Cairo', label: 'Cairo (EET)', keywords: 'cairo egypt' },
    { value: 'Africa/Casablanca', label: 'Casablanca (WET)', keywords: 'casablanca morocco' },
    { value: 'Africa/Lagos', label: 'Lagos (WAT)', keywords: 'lagos nigeria' },
    { value: 'Africa/Nairobi', label: 'Nairobi (EAT)', keywords: 'nairobi kenya' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', keywords: 'johannesburg cape town south africa' },
    { value: 'Africa/Accra', label: 'Accra (GMT)', keywords: 'accra ghana' },
    { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)', keywords: 'jerusalem tel aviv israel' },
    { value: 'Asia/Beirut', label: 'Beirut (EET)', keywords: 'beirut lebanon' },
  ]},
];

interface TimezoneComboboxProps {
  value: string;
  onChange: (v: string) => void;
  isAutoDetected: boolean;
}

export function TimezoneCombobox({ value, onChange, isAutoDetected }: TimezoneComboboxProps) {
  const [open, setOpen] = useState(false);

  const allZones = TIMEZONE_OPTIONS.flatMap(g => g.zones);
  const selectedLabel = allZones.find(z => z.value === value)?.label || value;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs">
        <Globe className="h-3 w-3 text-muted-foreground" />
        Time Zone
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-8 text-sm font-normal"
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search timezone or city..." className="h-8 text-sm" />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>No timezone found.</CommandEmpty>
              {TIMEZONE_OPTIONS.map((group) => (
                <CommandGroup key={group.group} heading={group.group}>
                  {group.zones.map((tz) => (
                    <CommandItem
                      key={tz.value}
                      value={`${tz.label} ${tz.keywords}`}
                      onSelect={() => {
                        onChange(tz.value);
                        setOpen(false);
                      }}
                      className="text-sm"
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", value === tz.value ? "opacity-100" : "opacity-0")} />
                      {tz.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-[10px] text-muted-foreground">
        {isAutoDetected ? 'Auto-detected from your Home Base' : 'Manually set — overrides Home Base detection'}
      </p>
    </div>
  );
}
