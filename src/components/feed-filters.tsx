"use client";

import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Quick filters on an outfit's feed. They aren't saved: categories and stores are the outfit's lasting settings.
export type Filters = { sizes: string[]; colours: string[]; maxPrice: number | null; sale: boolean; fresh: boolean };
export const NO_FILTERS: Filters = { sizes: [], colours: [], maxPrice: null, sale: false, fresh: false };

// size tokens the pipeline extracts from each product's in-stock variants
const SIZES = ["XS", "S", "M", "L", "XL", "6", "8", "10", "12", "14", "16"];
// must match COLOURS in pipeline/ingest.py
const COLOURS: Record<string, string> = {
  Black: "#1f1b18",
  White: "#ffffff",
  Cream: "#ece0c8",
  Brown: "#6e4a35",
  Grey: "#9b9690",
  Red: "#a8322a",
  Pink: "#e9a5b8",
  Orange: "#dd7a3a",
  Yellow: "#efcc5c",
  Green: "#6f8f5c",
  Blue: "#3f5f9e",
  Purple: "#8c6bb1",
  Print: "conic-gradient(#a8322a, #efcc5c, #6f8f5c, #3f5f9e, #e9a5b8, #a8322a)",
};
const PRICE_STEP = 10;
const PRICE_MAX = 500;

export const filterCount = (f: Filters) => f.sizes.length + f.colours.length + (f.maxPrice ? 1 : 0) + (f.sale ? 1 : 0) + (f.fresh ? 1 : 0);

export function FeedFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const count = filterCount(value);

  const pills = [
    ...value.sizes.map((s) => ({ label: `Size ${s}`, clear: { ...value, sizes: value.sizes.filter((x) => x !== s) } })),
    ...value.colours.map((c) => ({ label: c, clear: { ...value, colours: value.colours.filter((x) => x !== c) } })),
    ...(value.maxPrice ? [{ label: `Under $${value.maxPrice}`, clear: { ...value, maxPrice: null } }] : []),
    ...(value.sale ? [{ label: "On sale", clear: { ...value, sale: false } }] : []),
    ...(value.fresh ? [{ label: "New this week", clear: { ...value, fresh: false } }] : []),
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
      >
        <SlidersHorizontalIcon /> Filters
        {count > 0 && <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{count}</span>}
      </Button>
      {pills.map((p) => (
        <button key={p.label} onClick={() => onChange(p.clear)} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
          {p.label} <XIcon className="size-3.5" />
        </button>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="bg-transparent p-0 ring-0 sm:max-w-md">
          <div className="panel grid gap-6">
            <h2 className="font-heading text-3xl font-semibold">Filters</h2>

            <div className="grid gap-2">
              <Label>Size in stock</Label>
              <div className="flex flex-wrap gap-1.5">
                {SIZES.map((s) => (
                  <Chip
                    key={s}
                    on={draft.sizes.includes(s)}
                    onClick={() => setDraft({ ...draft, sizes: draft.sizes.includes(s) ? draft.sizes.filter((x) => x !== s) : [...draft.sizes, s] })}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(COLOURS).map(([name, swatch]) => (
                  <Chip
                    key={name}
                    on={draft.colours.includes(name)}
                    onClick={() =>
                      setDraft({ ...draft, colours: draft.colours.includes(name) ? draft.colours.filter((x) => x !== name) : [...draft.colours, name] })
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="size-3.5 rounded-full ring-1 ring-foreground/15" style={{ background: swatch }} />
                      {name}
                    </span>
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max-price">
                Max price <span className="font-normal text-muted-foreground">{draft.maxPrice ? `up to $${draft.maxPrice}` : "any"}</span>
              </Label>
              <input
                id="max-price"
                type="range"
                min={30}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={draft.maxPrice ?? PRICE_MAX}
                onChange={(e) => setDraft({ ...draft, maxPrice: Number(e.target.value) >= PRICE_MAX ? null : Number(e.target.value) })}
                className="accent-[#6e4a35]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip on={draft.sale} onClick={() => setDraft({ ...draft, sale: !draft.sale })}>
                On sale
              </Chip>
              <Chip on={draft.fresh} onClick={() => setDraft({ ...draft, fresh: !draft.fresh })}>
                New this week
              </Chip>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setDraft(NO_FILTERS)}>
                Reset
              </Button>
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Show results
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}
