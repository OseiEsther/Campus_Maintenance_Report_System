'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronDown, Search, Camera, X, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data-context';
import { uploadReportPhoto } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { categoryLabel, buildingTypeLabel } from '@/lib/format';
import { CategoryIcon } from '@/components/shared/category-icon';
import type { Category } from '@/lib/types';
import type { ScreenName } from '@/components/shared/app-shell';

const categories: Category[] = [
  'electrical',
  'plumbing',
  'structural',
  'sanitation',
  'other',
];

const MAX_CHARS = 500;

export function NewReport({
  onNavigate,
  onOpenReport,
}: {
  onNavigate: (screen: ScreenName) => void;
  onOpenReport: (id: string) => void;
}) {
  const { locations, campusUnits, addReport, currentUser } = useData();
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [specificArea, setSpecificArea] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Group locations based on official Campus Units registry
  const groupedLocations = useMemo<Record<string, { id: string; name: string; hall: string }[]>>(() => {
    // If campus units are available, group cleanly by their official categories
    if (campusUnits && campusUnits.length > 0) {
      const groups: Record<string, { id: string; name: string; hall: string }[]> = {
        'Residence Halls': [],
        'Academic Departments': [],
        'Administrative Units': [],
      };

      campusUnits.forEach((unit) => {
        // Find matching location in locations table (synced by ID or name)
        const matchedLoc = locations.find((l) => l.id === unit.id || l.name.toLowerCase() === unit.name.toLowerCase());
        const locId = matchedLoc ? matchedLoc.id : unit.id;
        const entry = { id: locId, name: unit.name, hall: unit.name };

        if (unit.category === 'hall') {
          groups['Residence Halls'].push(entry);
        } else if (unit.category === 'department') {
          groups['Academic Departments'].push(entry);
        } else {
          groups['Administrative Units'].push(entry);
        }
      });

      return groups;
    }

    // Fallback: group standard locations by building type
    const fallbackGroups: Record<string, { id: string; name: string; hall: string }[]> = {};
    locations.forEach((loc) => {
      const key = buildingTypeLabel(loc.building_type);
      if (!fallbackGroups[key]) fallbackGroups[key] = [];
      fallbackGroups[key].push({
        id: loc.id,
        name: loc.name,
        hall: loc.hall || loc.name,
      });
    });
    return fallbackGroups;
  }, [campusUnits, locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!locationId) newErrors.location = 'Please select a campus hall, building, or unit';
    if (!category) newErrors.category = 'Please select a category';
    if (description.trim().length < 20)
      newErrors.description = 'Please provide at least 20 characters describing the issue';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      const selectedLoc = locations.find((l) => l.id === locationId);
      const cleanSpecific = specificArea.trim();
      const finalLocationName = cleanSpecific
        ? `${locationName} (${cleanSpecific})`
        : locationName;

      const newReport = await addReport({
        location_id: locationId,
        location_name: finalLocationName,
        hall: selectedLoc?.hall || locationName,
        category: category as Category,
        description: description.trim(),
        photo_url: photoUrl,
      });
      setSubmitting(false);
      onOpenReport(newReport.id);
    } catch (err) {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Invalid File Format', {
        description: 'Please upload an image file (PNG, JPG, WebP, GIF, HEIC).',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File Exceeds 10 MB', {
        description: 'Please select an incident photo under 10 MB in size.',
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const url = await uploadReportPhoto(file, currentUser.id);
      setPhotoUrl(url);
      toast.success('Incident Photo Uploaded', {
        description: 'Photo evidence successfully saved to Supabase storage.',
      });
    } catch (err: any) {
      console.warn('Error uploading photo:', err);
      setPhotoUrl(null);
      toast.error('Photo Upload Failed', {
        description: err.message || 'Could not upload photo to storage. You may try again or submit without a photo.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 pb-1 border-b border-border/60">
        <button
          onClick={() => onNavigate('home')}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
          title="Return to feed"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              Report Campus Incident
            </h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
              NEW WORK ORDER
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Provide precise location and details to trigger verification signals and crew dispatch.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-6">
        {/* Campus Unit Location */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-semibold">
              Campus Facility / Building
            </Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal text-xs h-9"
                >
                  {locationName || 'Select a hall, academic department, or administrative unit...'}
                  <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search campus unit..." className="text-xs" />
                  <CommandList>
                    <CommandEmpty className="text-xs py-3 text-center">No campus unit found.</CommandEmpty>
                    {Object.entries(groupedLocations).map(([group, locs]) => (
                      <CommandGroup key={group} heading={group}>
                        {locs.map((loc) => (
                          <CommandItem
                            key={loc.id}
                            value={loc.name}
                            onSelect={() => {
                              setLocationId(loc.id);
                              setLocationName(loc.name);
                              setPopoverOpen(false);
                            }}
                            className="text-xs"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-3.5 w-3.5',
                                locationId === loc.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {loc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.location && (
              <p className="text-xs text-destructive">{errors.location}</p>
            )}
          </div>

          {/* Specific Room / Area (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="specificArea" className="text-xs font-semibold text-foreground">
              Room or Specific Spot <span className="text-muted-foreground font-normal">(Optional)</span>
            </Label>
            <Input
              id="specificArea"
              value={specificArea}
              onChange={(e) => setSpecificArea(e.target.value)}
              placeholder="e.g. Room 204, 2nd Floor Restroom, Lab 3, Block A Stairwell"
              className="h-9 text-xs font-normal"
              maxLength={80}
            />
            <p className="text-[11px] text-muted-foreground">
              Pinpoints the exact location within the selected campus building or hall.
            </p>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Maintenance Category</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((cat) => {
              const selected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left',
                    selected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <CategoryIcon category={cat} className="h-3.5 w-3.5 shrink-0" />
                  <span>{categoryLabel(cat)}</span>
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-xs font-semibold">Incident Description</Label>
            <span
              className={cn(
                'font-mono text-[11px] tabular-nums',
                description.length > MAX_CHARS
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              )}
            >
              {description.length}/{MAX_CHARS}
            </span>
          </div>
          <Textarea
            id="description"
            placeholder="Describe the issue in detail. What is wrong? When did you notice it? Is it getting worse? The more detail you provide, the faster it can be addressed."
            value={description}
            onChange={(e) =>
              setDescription(e.target.value.slice(0, MAX_CHARS + 50))
            }
            rows={5}
          />
          {errors.description ? (
            <p className="text-xs text-destructive">{errors.description}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Minimum 20 characters. Be specific: include what, when, and severity.
            </p>
          )}
        </div>

        {/* Photo upload */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Incident Photo Evidence (Optional)</Label>
          {uploadingPhoto ? (
            <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uploading photo to Supabase storage...</span>
            </div>
          ) : photoUrl ? (
            <div className="relative inline-block overflow-hidden rounded-lg border border-border shadow-xs">
              <img
                src={photoUrl}
                alt="Upload preview"
                className="h-44 w-full max-w-sm object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black transition-colors"
                title="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="group flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 hover:border-zinc-400 hover:bg-muted/40 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-xs font-medium text-foreground">
                Click to attach photo evidence
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                JPG, PNG up to 10MB &bull; +2 pts verification
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={() => onNavigate('home')}
            className="text-xs font-medium h-9.5 px-4 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="text-xs font-medium h-9.5 px-5 rounded-lg shadow-xs hover:shadow transition-all"
          >
            {submitting ? 'Dispatching Work Order...' : 'Submit Incident Report'}
          </Button>
        </div>
      </form>
    </div>
  );
}
