'use client';

import { useState, useMemo } from 'react';
import {
  MapPin,
  Building,
  CheckCircle2,
  ChevronRight,
  Search,
  LayoutGrid,
  Layers,
  Compass,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { SignalMeter } from '@/components/shared/signal-meter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatReportToken, buildingTypeLabel } from '@/lib/format';
import type { Report, Location, BuildingType } from '@/lib/types';

interface DynamicBuildingDef {
  id: string;
  name: string;
  building_type: BuildingType;
  typeLabel: string;
  zone: string;
  tier: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isCompact?: boolean;
  labelX: number;
  labelY: number;
  pinX: number;
  pinY: number;
}

interface SectorMeta {
  zone: string;
  tierIndex: number;
  headerY: number;
  startY: number;
  endY: number;
  tierH: number;
  walkwayY: number;
}

interface CampusLayoutResult {
  buildings: DynamicBuildingDef[];
  canvasHeight: number;
  sectorMeta: SectorMeta[];
}

/**
 * Dynamically computes architectural blueprint coordinates across an adaptive canvas
 * based directly on the university's registered database locations.
 * Automatically wraps into multi-row sector grids when facility counts exceed 4 per sector,
 * comfortably handling 20, 30+ locations without clipping or overlapping.
 */
function computeCampusLayout(locations: Location[]): CampusLayoutResult {
  if (!locations || locations.length === 0) {
    return { buildings: [], canvasHeight: 560, sectorMeta: [] };
  }

  // Categorize registered locations into 3 natural campus sectors
  const tier0: Location[] = []; // Residential (North Quad)
  const tier1: Location[] = []; // Academic & Library (Central Knowledge Spine)
  const tier2: Location[] = []; // Dining, Athletics, Admin (South Commons)

  locations.forEach((loc) => {
    if (loc.building_type === 'residence') {
      tier0.push(loc);
    } else if (loc.building_type === 'academic' || loc.building_type === 'library') {
      tier1.push(loc);
    } else {
      tier2.push(loc);
    }
  });

  // Re-balance unclassified or empty tiers
  const classifiedIds = new Set([...tier0, ...tier1, ...tier2].map((l) => l.id));
  const others = locations.filter((l) => !classifiedIds.has(l.id));
  others.forEach((l) => {
    const minTier = [tier0, tier1, tier2].sort((a, b) => a.length - b.length)[0];
    minTier.push(l);
  });

  const tierDefs = [
    { items: tier0, zone: 'North Residential Quad', tierIndex: 0, defaultH: 88 },
    { items: tier1, zone: 'Central Academic Spine', tierIndex: 1, defaultH: 105 },
    { items: tier2, zone: 'South Commons & Concourse', tierIndex: 2, defaultH: 95 },
  ];

  const results: DynamicBuildingDef[] = [];
  const usableWidth = 800;
  const minX = 80;
  const sectorMeta: SectorMeta[] = [];

  let currentY = 62;

  tierDefs.forEach(({ items, zone, tierIndex, defaultH }) => {
    const count = items.length;
    if (count === 0) return;

    // Multi-row auto wrapping when count exceeds 4 facilities per sector
    const numRows = count <= 4 ? 1 : Math.ceil(count / 4);
    const subH = numRows === 1 ? defaultH : count <= 8 ? 58 : 52;
    const rowGap = 10;
    const tierH = numRows * subH + (numRows - 1) * rowGap;

    const headerY = currentY - 14;
    const startY = currentY;

    // Distribute items evenly across rows
    const itemsPerRow = Math.ceil(count / numRows);
    for (let r = 0; r < numRows; r++) {
      const rowItems = items.slice(r * itemsPerRow, (r + 1) * itemsPerRow);
      const rowCount = rowItems.length;
      if (rowCount === 0) continue;

      const gap = rowCount > 1 ? Math.max(14, Math.min(26, (usableWidth - rowCount * 140) / (rowCount - 1))) : 0;
      const maxW = rowCount === 1 ? 260 : rowCount === 2 ? 220 : rowCount === 3 ? 190 : 180;
      const minW = rowCount >= 5 ? 95 : 110;
      const calculatedW = Math.max(minW, Math.min(maxW, (usableWidth - (rowCount - 1) * gap) / rowCount));
      const totalW = rowCount * calculatedW + (rowCount - 1) * gap;
      const startX = minX + (usableWidth - totalW) / 2;
      const rowY = Math.round(startY + r * (subH + rowGap));

      rowItems.forEach((loc, i) => {
        const x = Math.round(startX + i * (calculatedW + gap));
        const w = Math.round(calculatedW);
        const h = subH;
        const isCompact = subH < 70;

        results.push({
          id: loc.id,
          name: loc.name,
          building_type: loc.building_type,
          typeLabel: buildingTypeLabel(loc.building_type),
          zone,
          tier: tierIndex,
          x,
          y: rowY,
          w,
          h,
          isCompact,
          labelX: isCompact ? Math.round(x + 14) : Math.round(x + w / 2),
          labelY: isCompact ? Math.round(rowY + h / 2 - 4) : Math.round(rowY + h / 2 - 6),
          pinX: isCompact ? Math.round(x + w - 20) : Math.round(x + w / 2),
          pinY: isCompact ? Math.round(rowY + h / 2) : Math.round(rowY + h - 16),
        });
      });
    }

    const endY = startY + tierH;
    sectorMeta.push({
      zone,
      tierIndex,
      headerY,
      startY,
      endY,
      tierH,
      walkwayY: endY + 16,
    });

    // Spacing between sectors
    currentY = endY + 36;
  });

  const canvasHeight = Math.max(560, Math.round(currentY + 20));

  return { buildings: results, canvasHeight, sectorMeta };
}

export function CampusVectorMap({
  reports = [],
  locations = [],
  onOpenReport,
}: {
  reports: Report[];
  locations?: Location[];
  onOpenReport: (id: string) => void;
}) {
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [hoveredLocId, setHoveredLocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'issues_only' | 'open_only'>('all');
  const [viewMode, setViewMode] = useState<'blueprint' | 'sectors'>('blueprint');
  const [locCategoryFilter, setLocCategoryFilter] = useState<string>('all');

  // Compute dynamic footprints and adaptive canvas geometry
  const layout = useMemo(() => {
    return computeCampusLayout(locations);
  }, [locations]);

  const campusBuildings = layout.buildings;

  // Compute telemetry metrics per building
  const buildingData = useMemo(() => {
    const map: Record<
      string,
      {
        building: DynamicBuildingDef;
        reports: Report[];
        openCount: number;
        inProgressCount: number;
        resolvedCount: number;
        status: 'open' | 'in_progress' | 'resolved' | 'clear';
      }
    > = {};

    campusBuildings.forEach((b) => {
      const bReports = reports.filter(
        (r) =>
          (r.location_id === b.id ||
            r.location_name.toLowerCase().includes(b.name.toLowerCase())) &&
          !r.is_archived
      );
      const openCount = bReports.filter((r) => r.status === 'open').length;
      const inProgressCount = bReports.filter((r) => r.status === 'in_progress').length;
      const resolvedCount = bReports.filter((r) => r.status === 'resolved').length;

      let status: 'open' | 'in_progress' | 'resolved' | 'clear' = 'clear';
      if (openCount > 0) status = 'open';
      else if (inProgressCount > 0) status = 'in_progress';
      else if (resolvedCount > 0) status = 'resolved';

      map[b.id] = {
        building: b,
        reports: bReports,
        openCount,
        inProgressCount,
        resolvedCount,
        status,
      };
    });

    return map;
  }, [campusBuildings, reports]);

  // Filtered buildings based on search and status
  const visibleBuildings = useMemo(() => {
    return campusBuildings.filter((b) => {
      if (locCategoryFilter !== 'all' && b.building_type !== locCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.typeLabel.toLowerCase().includes(q)) {
          return false;
        }
      }
      const data = buildingData[b.id];
      if (!data) return true;
      if (filterMode === 'issues_only') return data.reports.length > 0;
      if (filterMode === 'open_only') return data.openCount > 0;
      return true;
    });
  }, [campusBuildings, buildingData, filterMode, locCategoryFilter, searchQuery]);

  // Selected building telemetry inspector
  const selectedData = selectedLocId ? buildingData[selectedLocId] : null;

  // Quad sector groupings for sector card view
  const sectorGroups = useMemo(() => {
    const groups = [
      {
        title: 'North Residential Quad',
        category: 'residence',
        items: campusBuildings.filter((b) => b.tier === 0),
      },
      {
        title: 'Central Academic & Knowledge Spine',
        category: 'academic',
        items: campusBuildings.filter((b) => b.tier === 1),
      },
      {
        title: 'South Commons & Facilities Concourse',
        category: 'facilities',
        items: campusBuildings.filter((b) => b.tier === 2),
      },
    ];
    return groups.filter((g) => g.items.length > 0);
  }, [campusBuildings]);

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-3">
        <Compass className="mx-auto h-10 w-10 text-muted-foreground opacity-50 animate-pulse" />
        <h3 className="font-heading text-base font-semibold text-foreground">
          No Campus Facilities Registered
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          The architectural map generates dynamically from your registered campus buildings.
          Provision facilities in Administration &gt; Campus Locations to activate the map.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Control & Telemetry Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono text-xs font-bold shadow-xs">
            GIS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Architectural Campus Blueprint
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-border font-medium">
                {locations.length} REGISTERED FACILITIES
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Directly reflecting database facilities. Select any footprint to inspect active work orders.
            </p>
          </div>
        </div>

        {/* View Switcher & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative w-40 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs w-full bg-background"
            />
          </div>

          {/* Filter status buttons */}
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({campusBuildings.length})
            </button>
            <button
              onClick={() => setFilterMode('issues_only')}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filterMode === 'issues_only'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Issues Only
            </button>
          </div>

          {/* View mode toggle */}
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode('blueprint')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'blueprint'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Architectural Vector Blueprint"
            >
              <Compass className="h-3 w-3" />
              Blueprint
            </button>
            <button
              onClick={() => setViewMode('sectors')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                viewMode === 'sectors'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Quad Sector Grid"
            >
              <LayoutGrid className="h-3 w-3" />
              Quad Cards
            </button>
          </div>
        </div>
      </div>

      {/* 1. BLUEPRINT VECTOR VIEW */}
      {viewMode === 'blueprint' && (
        <div className="relative w-full overflow-hidden rounded-xl border border-border bg-zinc-50/50 dark:bg-zinc-950/40 p-2 shadow-xs transition-colors">
          <svg
            viewBox={`0 0 960 ${layout.canvasHeight}`}
            className="w-full h-auto select-none"
            style={{ maxHeight: layout.canvasHeight > 560 ? '700px' : '600px' }}
          >
            {/* Subtle Blueprint Grid Lines */}
            <defs>
              <pattern id="campus-svg-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-zinc-300/60 dark:text-zinc-800/60"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#campus-svg-grid)" />

            {/* Road Network & Pathways */}
            <g className="roads" strokeLinecap="round" strokeLinejoin="round">
              {/* Outer Perimeter Ring Road */}
              <path
                d={`M 50 160 Q 50 30 180 30 L 780 30 Q 910 30 910 160 L 910 ${layout.canvasHeight - 160} Q 910 ${layout.canvasHeight - 30} 780 ${layout.canvasHeight - 30} L 180 ${layout.canvasHeight - 30} Q 50 ${layout.canvasHeight - 30} 50 ${layout.canvasHeight - 160} Z`}
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                className="text-zinc-200/90 dark:text-zinc-800/80"
              />
              <path
                d={`M 50 160 Q 50 30 180 30 L 780 30 Q 910 30 910 160 L 910 ${layout.canvasHeight - 160} Q 910 ${layout.canvasHeight - 30} 780 ${layout.canvasHeight - 30} L 180 ${layout.canvasHeight - 30} Q 50 ${layout.canvasHeight - 30} 50 ${layout.canvasHeight - 160} Z`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="6 6"
                className="text-zinc-300 dark:text-zinc-700"
              />

              {/* Central Spine Avenue */}
              <path
                d={`M 240 160 L 240 ${layout.canvasHeight - 170} M 480 160 L 480 ${layout.canvasHeight - 170} M 720 160 L 720 ${layout.canvasHeight - 170}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-zinc-200/80 dark:text-zinc-800/70"
              />

              {/* Horizontal Crosswalk Malls */}
              {layout.sectorMeta.slice(0, -1).map((meta) => (
                <path
                  key={`crosswalk-${meta.tierIndex}`}
                  d={`M 70 ${meta.walkwayY} L 890 ${meta.walkwayY}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-zinc-200/80 dark:text-zinc-800/70"
                />
              ))}
            </g>

            {/* Architectural Sector Watermark Headers */}
            {layout.sectorMeta.map((meta) => (
              <text
                key={`sec-header-${meta.tierIndex}`}
                x="480"
                y={meta.headerY}
                textAnchor="middle"
                className="font-mono text-[9px] uppercase tracking-[0.25em] fill-zinc-400/80 dark:fill-zinc-600 select-none pointer-events-none font-semibold"
              >
                {meta.zone}
              </text>
            ))}

            {/* Landscaping / Quad Lawn Patches */}
            <g className="lawns opacity-40">
              <rect
                x="85"
                y={layout.sectorMeta[1] ? layout.sectorMeta[1].startY - 10 : 182}
                width="70"
                height={layout.sectorMeta[1] ? layout.sectorMeta[1].tierH + 20 : 165}
                rx="6"
                className="fill-emerald-200 dark:fill-emerald-950/40"
              />
              <rect
                x="805"
                y={layout.sectorMeta[1] ? layout.sectorMeta[1].startY - 10 : 182}
                width="70"
                height={layout.sectorMeta[1] ? layout.sectorMeta[1].tierH + 20 : 165}
                rx="6"
                className="fill-emerald-200 dark:fill-emerald-950/40"
              />
              <ellipse
                cx="480"
                cy={layout.sectorMeta[1] ? layout.sectorMeta[1].startY + layout.sectorMeta[1].tierH / 2 : 270}
                rx="40"
                ry="25"
                className="fill-emerald-100 dark:fill-emerald-950/30 stroke-emerald-300 dark:stroke-emerald-800/50"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </g>

            {/* Dynamic Building Footprints (Driven directly by PostgreSQL locations) */}
            {campusBuildings.map((b) => {
              const data = buildingData[b.id];
              const isVisible = visibleBuildings.some((vb) => vb.id === b.id);
              const isSelected = selectedLocId === b.id;
              const isHovered = hoveredLocId === b.id;
              const hasOpen = data && data.openCount > 0;
              const hasInProgress = data && data.inProgressCount > 0;

              let fillClass = 'fill-white dark:fill-zinc-900';
              let strokeClass = 'stroke-zinc-300 dark:stroke-zinc-700';

              if (isSelected) {
                fillClass = 'fill-indigo-50/80 dark:fill-indigo-950/50';
                strokeClass = 'stroke-indigo-600 dark:stroke-indigo-400 stroke-2';
              } else if (isHovered) {
                fillClass = 'fill-zinc-50 dark:fill-zinc-800';
                strokeClass = 'stroke-zinc-500 dark:stroke-zinc-400 stroke-[1.5]';
              }

              return (
                <g
                  key={b.id}
                  onClick={() => setSelectedLocId(isSelected ? null : b.id)}
                  onMouseEnter={() => setHoveredLocId(b.id)}
                  onMouseLeave={() => setHoveredLocId(null)}
                  className={`cursor-pointer transition-opacity duration-200 ${
                    isVisible ? 'opacity-100' : 'opacity-25'
                  }`}
                >
                  {/* Building Drop Shadow */}
                  <rect
                    x={b.x}
                    y={b.y + 3}
                    width={b.w}
                    height={b.h}
                    rx="6"
                    className="fill-zinc-300/40 dark:fill-black/50"
                  />

                  {/* Building Main Volume */}
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx="6"
                    className={`${fillClass} ${strokeClass} transition-colors`}
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  {/* Architectural Internal Roof Lines */}
                  <rect
                    x={b.x + 5}
                    y={b.y + 5}
                    width={b.w - 10}
                    height={b.h - 10}
                    rx="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    className="text-zinc-200 dark:text-zinc-800"
                  />

                  {/* Building Name Label */}
                  <text
                    x={b.labelX}
                    y={b.labelY - (b.isCompact ? 4 : 5)}
                    textAnchor={b.isCompact ? 'start' : 'middle'}
                    className={`font-sans ${b.isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold fill-zinc-800 dark:fill-zinc-100 tracking-tight select-none pointer-events-none`}
                  >
                    {b.name.length > (b.isCompact ? 18 : 22) ? `${b.name.slice(0, b.isCompact ? 16 : 20)}...` : b.name}
                  </text>

                  {/* Building Type Tag */}
                  <text
                    x={b.labelX}
                    y={b.labelY + (b.isCompact ? 8 : 9)}
                    textAnchor={b.isCompact ? 'start' : 'middle'}
                    className={`font-mono ${b.isCompact ? 'text-[8.5px]' : 'text-[9px]'} fill-zinc-400 dark:fill-zinc-500 font-medium select-none pointer-events-none`}
                  >
                    {b.typeLabel}
                  </text>

                  {/* Live Telemetry Radar Pin */}
                  {data && (
                    <g transform={`translate(${b.pinX}, ${b.pinY})`}>
                      {hasOpen ? (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r={b.isCompact ? 11 : 14}
                            className="animate-ping fill-rose-500/30"
                          />
                          <circle
                            cx="0"
                            cy="0"
                            r={b.isCompact ? 7.5 : 9}
                            className="fill-rose-600 shadow-sm"
                          />
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dy={b.isCompact ? '3' : '3.5'}
                            className={`fill-white font-mono ${b.isCompact ? 'text-[9px]' : 'text-[10px]'} font-bold select-none pointer-events-none`}
                          >
                            {data.openCount}
                          </text>
                        </>
                      ) : hasInProgress ? (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r={b.isCompact ? 10 : 12}
                            className="animate-ping fill-amber-500/25"
                          />
                          <circle
                            cx="0"
                            cy="0"
                            r={b.isCompact ? 7 : 8}
                            className="fill-amber-500 shadow-sm"
                          />
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            dy={b.isCompact ? '2.5' : '3'}
                            className={`fill-white font-mono ${b.isCompact ? 'text-[8.5px]' : 'text-[9px]'} font-bold select-none pointer-events-none`}
                          >
                            {data.inProgressCount}
                          </text>
                        </>
                      ) : (
                        <>
                          <circle
                            cx="0"
                            cy="0"
                            r={b.isCompact ? 6 : 7}
                            className="fill-emerald-500 shadow-xs"
                          />
                          <path
                            d="M -3 0 L -1 2 L 3 -2"
                            fill="none"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Campus Geographic Stamp */}
            <g
              transform={`translate(865, ${layout.canvasHeight - 35})`}
              className="text-[9px] font-mono fill-zinc-400 select-none pointer-events-none"
            >
              <text textAnchor="end">CAMPUS MASTER GRID: 5°39&apos;N 0°11&apos;W</text>
            </g>
          </svg>

          {/* Blueprint Map Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2.5 px-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Open Work Order
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Crew Dispatched
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Normal / Resolved
              </span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/80">
              {reports.filter((r) => r.status === 'open' && !r.is_archived).length} Open Issues
              Across {locations.length} Facilities
            </div>
          </div>
        </div>
      )}

      {/* 2. QUAD SECTOR CARDS VIEW */}
      {viewMode === 'sectors' && (
        <div className="space-y-4 animate-fade-in">
          {sectorGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    {group.title}
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {group.items.length} {group.items.length === 1 ? 'facility' : 'facilities'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((b) => {
                  const data = buildingData[b.id];
                  const isSelected = selectedLocId === b.id;
                  const openCount = data?.openCount || 0;
                  const inProgressCount = data?.inProgressCount || 0;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedLocId(isSelected ? null : b.id)}
                      className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                          : 'border-border bg-muted/20 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-muted/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-semibold text-xs text-foreground truncate" title={b.name}>
                          {b.name}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-medium block">
                          {b.typeLabel}
                        </span>
                        <p className="text-[10px] text-muted-foreground pt-1">
                          {data?.reports.length || 0} total tickets logged
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                        {openCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                            {openCount} Open
                          </span>
                        ) : inProgressCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {inProgressCount} Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Clear
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. FACILITY TELEMETRY INSPECTOR */}
      {(() => {
        if (!selectedData) {
          return (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Click on any footprint in the architectural blueprint or any facility in the registry below to inspect tickets.
              </span>
              <span className="font-mono text-[11px] shrink-0">
                {reports.length} Total Reports across {locations.length} Facilities
              </span>
            </div>
          );
        }

        return (
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4 animate-scale-up">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-primary" />
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {selectedData.building.name}
                  </h3>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-medium">
                    {selectedData.building.typeLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Located in <span className="font-semibold text-foreground">{selectedData.building.zone}</span>. {selectedData.reports.length}{' '}
                  {selectedData.reports.length === 1 ? 'total incident' : 'total incidents'} logged.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLocId(null)}
                className="text-xs h-7"
              >
                Close Inspector
              </Button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Open Issues
                </span>
                <span className="font-mono text-base font-bold text-status-open">
                  {selectedData.openCount}
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  In Progress
                </span>
                <span className="font-mono text-base font-bold text-status-progress">
                  {selectedData.inProgressCount}
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Resolved
                </span>
                <span className="font-mono text-base font-bold text-status-resolved">
                  {selectedData.resolvedCount}
                </span>
              </div>
            </div>

            {/* Incidents List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Facility Work Orders ({selectedData.reports.length})
              </h4>

              {selectedData.reports.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500 mb-1" />
                  <p className="text-xs font-medium text-foreground">
                    No active incidents in {selectedData.building.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Facilities telemetry confirms this sector is operating normally.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedData.reports.map((report) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/10 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-border">
                            {formatReportToken(report.id)}
                          </span>
                          <StatusBadge status={report.status} />
                          <span className="text-xs font-medium text-foreground truncate">
                            {report.location_name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {report.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SignalMeter score={report.verification_score} showNumber />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => onOpenReport(report.id)}
                        >
                          Inspect
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 4. SYNCHRONIZED REGISTERED CAMPUS FACILITIES CONCOURSE */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              Registered Campus Facilities &amp; Zones ({locations.length})
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Direct database synchronization. Click any facility to highlight its blueprint footprint above and inspect tickets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(
              ['all', 'residence', 'academic', 'library', 'administrative', 'sports', 'dining'] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setLocCategoryFilter(cat)}
                className={`px-2 py-0.5 text-[10px] font-medium rounded capitalize transition-all ${
                  locCategoryFilter === cat
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground bg-muted/40'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
          {locations
            .filter((loc) => locCategoryFilter === 'all' || loc.building_type === locCategoryFilter)
            .map((loc) => {
              const locReports = reports.filter(
                (r) =>
                  (r.location_id === loc.id ||
                    r.location_name.toLowerCase().includes(loc.name.toLowerCase())) &&
                  !r.is_archived
              );
              const openCount = locReports.filter((r) => r.status === 'open').length;
              const inProgressCount = locReports.filter((r) => r.status === 'in_progress').length;
              const isSelected = selectedLocId === loc.id;

              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLocId(isSelected ? null : loc.id)}
                  className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 text-left text-xs transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                      : 'border-border bg-muted/20 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-muted/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate" title={loc.name}>
                      {loc.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {buildingTypeLabel(loc.building_type)}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                    {openCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        {openCount}
                      </span>
                    ) : inProgressCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {inProgressCount}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        OK
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
