'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import * as RechartsPrimitive from 'recharts';

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error('useChart must be used within a ChartContainer');
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          'flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme || item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => {
            const variables = colorConfig
              .map(([key, item]) => {
                const color = item.theme?.[theme as keyof typeof THEMES] || item.color;
                return color ? `  --color-${key}: ${color};` : null;
              })
              .filter(Boolean)
              .join('\n');
            return `${prefix} [data-chart=${id}] {\n${variables}\n}`;
          })
          .join('\n'),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
  active,
  payload,
  className,
  hideLabel = false,
  hideIndicator = false,
  labelFormatter,
  formatter,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<'div'> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: 'line' | 'dot' | 'dashed';
    nameKey?: string;
    labelKey?: string;
  }) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  const tooltipPayload = payload[0]?.payload as { fullDate?: string; date?: string } | undefined;
  const label = tooltipPayload?.fullDate || tooltipPayload?.date;

  return (
    <div className={cn('min-w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-xl', className)}>
      {!hideLabel && label && <div className="mb-1.5 font-medium text-gray-900">{labelFormatter ? labelFormatter(label, payload) : label}</div>}
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = `${item.dataKey || item.name || 'value'}`;
          const itemConfig = config[key];
          const color = item.payload?.fill || item.color || 'currentColor';

          return (
            <div key={key} className="flex items-center gap-2">
              {!hideIndicator && <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />}
              {formatter && item.value !== undefined
                ? formatter(item.value, item.name || key, item, 0, item.payload)
                : <><span className="text-gray-500">{itemConfig?.label || item.name || key}</span><span className="ml-auto font-mono font-medium tabular-nums text-gray-900">{Number(item.value || 0).toLocaleString('id-ID')}</span></>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  payload,
  className,
}: React.ComponentProps<'div'> & Pick<RechartsPrimitive.LegendProps, 'payload'>) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-3 text-xs text-gray-500', className)}>
      {payload.map((item) => {
        const key = `${item.dataKey || item.value || 'value'}`;
        return (
          <span key={key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {config[key]?.label || item.value}
          </span>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
