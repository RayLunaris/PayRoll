'use client';

import { Card } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export type SwitchListItem = {
  title: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

type PatternProps = {
  items?: SwitchListItem[];
  className?: string;
  showCard?: boolean;
};

const defaultItems: SwitchListItem[] = [
  { title: 'Push notifications', defaultChecked: true },
  { title: 'Email notifications' },
  { title: 'SMS notifications' },
];

export function Pattern({ items = defaultItems, className, showCard = true }: PatternProps) {
  const content = (
    <FieldGroup className="gap-0">
      {items.map((item, index) => (
        <Field key={item.title}>
          <FieldLabel className="justify-between gap-4 px-4 py-3">
            <span className="min-w-0">
              <FieldTitle className="block">{item.title}</FieldTitle>
              {item.description && <span className="mt-1 block text-xs leading-5 text-gray-500">{item.description}</span>}
            </span>
            <Switch
              checked={item.checked}
              defaultChecked={item.defaultChecked}
              onCheckedChange={item.onCheckedChange}
              aria-label={item.title}
            />
          </FieldLabel>
          {index < items.length - 1 && <Separator />}
        </Field>
      ))}
    </FieldGroup>
  );

  return showCard ? <Card className={className}>{content}</Card> : <div className={className}>{content}</div>;
}

export default Pattern;
