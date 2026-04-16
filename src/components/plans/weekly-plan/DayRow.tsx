import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ChevronDown, Pencil, Merge, Share2, Trash2, X, MapPin, Plane } from 'lucide-react';
import { Plan, DayAvailability } from '@/types/planner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { PlanCardCompact } from './PlanCardCompact';
import { SwipeStack } from './SwipeStack';
import { getLocationLabel } from './planCardHelpers';

export interface SelectionActions {
  selectedCount: number;
  onEdit?: () => void;
  onMerge?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onExit: () => void;
}

interface DayRowProps {
  day: Date;
  dayPlans: Plan[];
  isToday: boolean;
  isPast: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onEditPlan?: (plan: Plan) => void;
  onCardTap: (id: string) => void;
  availabilityMap: Record<string, DayAvailability>;
  homeAddress: string | null;
  selectionActions?: SelectionActions;
}

export function DayRow({ day, dayPlans, isToday, isPast, selectMode, selectedIds, toggleSelect, onEditPlan, onCardTap, availabilityMap, homeAddress, selectionActions }: DayRowProps) {
  const key = format(day, 'yyyy-MM-dd');
  const locInfo = getLocationLabel(key, availabilityMap, homeAddress);

  return (
    <div className={cn("rounded-xl transition-colors")}>
      <div className={cn("flex items-center gap-2 px-3 py-1.5 relative z-10", isToday && "text-primary")}>
        <span className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold shrink-0",
          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}>
          {format(day, 'd')}
        </span>
        <span className={cn(
          "text-sm font-medium",
          isToday ? "text-primary font-semibold" : "text-muted-foreground"
        )}>
          {format(day, 'EEEE')}
        </span>
        {locInfo && (
          <span className={cn(
            "flex items-center gap-0.5 text-xs font-medium truncate max-w-[200px]",
            locInfo.isSplit ? "text-amber-600 dark:text-amber-400" : locInfo.isAway ? "text-availability-away-foreground text-secondary" : "text-muted-foreground/70"
          )}>
            {locInfo.isSplit ? <Plane className="h-2.5 w-2.5 shrink-0" /> : locInfo.isAway ? <Plane className="h-2.5 w-2.5 shrink-0" /> : <MapPin className="h-2.5 w-2.5 shrink-0" />}
            {locInfo.label}
          </span>
        )}
        {dayPlans.length > 1 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary ml-auto shrink-0">
            {dayPlans.length}
          </span>
        )}
      </div>
      {dayPlans.length > 0 ? (
        <div className="px-3 mt-1 mb-3 space-y-1.5">
          {selectionActions && dayPlans.some(p => selectedIds.has(p.id)) && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5"
              >
                <span className="text-[10px] font-medium text-primary mr-auto">
                  {selectionActions.selectedCount} selected
                </span>
                {selectionActions.onEdit && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={selectionActions.onEdit}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {selectionActions.onMerge && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={selectionActions.onMerge}>
                    <Merge className="h-3 w-3" />
                  </Button>
                )}
                {selectionActions.onShare && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={selectionActions.onShare}>
                    <Share2 className="h-3 w-3" />
                  </Button>
                )}
                {selectionActions.onDelete && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={selectionActions.onDelete}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={selectionActions.onExit}>
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            </AnimatePresence>
          )}
          {dayPlans.length === 1 ? (
            <PlanCardCompact
              plan={dayPlans[0]}
              selectMode={selectMode}
              selected={selectedIds.has(dayPlans[0].id)}
              onTap={() => onCardTap(dayPlans[0].id)}
              onLongPress={() => onCardTap(dayPlans[0].id)}
            />
          ) : (
            <SwipeStack
              plans={dayPlans}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onCardTap={onCardTap}
            />
          )}
        </div>
      ) : (
        <div className="px-3 pb-2">
          <div className="h-[1px] bg-border/40 mx-7" />
        </div>
      )}
    </div>
  );
}

interface PastDaysCollapsibleProps {
  weekDays: Date[];
  today: Date;
  plansByDay: Map<string, Plan[]>;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onEditPlan?: (plan: Plan) => void;
  onCardTap: (id: string) => void;
  availabilityMap: Record<string, DayAvailability>;
  homeAddress: string | null;
  selectionActions?: SelectionActions;
}

export function PastDaysCollapsible({ weekDays, today, plansByDay, selectMode, selectedIds, toggleSelect, onEditPlan, onCardTap, availabilityMap, homeAddress, selectionActions }: PastDaysCollapsibleProps) {
  const [showPast, setShowPast] = useState(false);

  const pastDays = weekDays.filter(d => d < today && !isSameDay(d, today));
  const currentAndFutureDays = weekDays.filter(d => isSameDay(d, today) || d > today);
  const pastPlanCount = pastDays.reduce((sum, d) => sum + (plansByDay.get(format(d, 'yyyy-MM-dd'))?.length || 0), 0);

  return (
    <div className="space-y-1">
      {pastDays.length > 0 && (
        <button
          onClick={() => setShowPast(!showPast)}
          className="flex items-center gap-2 px-3 py-1.5 w-full text-left group"
        >
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            !showPast && "-rotate-90"
          )} />
          <span className="font-medium text-muted-foreground text-xs">
            {pastDays.length} past day{pastDays.length > 1 ? 's' : ''}
            {pastPlanCount > 0 && ` · ${pastPlanCount} plan${pastPlanCount > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {showPast && pastDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayPlans = plansByDay.get(key) || [];
          return (
            <motion.div
              key={key}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <DayRow
                day={day}
                dayPlans={dayPlans}
                isToday={false}
                isPast={true}
                selectMode={selectMode}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                onEditPlan={onEditPlan}
                onCardTap={onCardTap}
                availabilityMap={availabilityMap}
                homeAddress={homeAddress}
                selectionActions={selectionActions}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {currentAndFutureDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayPlans = plansByDay.get(key) || [];
        const isDayToday = isSameDay(day, today);
        return (
          <DayRow
            key={key}
            day={day}
            dayPlans={dayPlans}
            isToday={isDayToday}
            isPast={false}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            onEditPlan={onEditPlan}
            onCardTap={onCardTap}
            availabilityMap={availabilityMap}
            homeAddress={homeAddress}
            selectionActions={selectionActions}
          />
        );
      })}
    </div>
  );
}
