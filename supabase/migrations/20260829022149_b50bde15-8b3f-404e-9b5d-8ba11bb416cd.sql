CREATE TYPE public.property_kind AS ENUM ('apartment','house','townhouse','studio','land');

ALTER TABLE public.listings ADD COLUMN property_type public.property_kind NOT NULL DEFAULT 'apartment';
ALTER TABLE public.wanted_ads ADD COLUMN property_types public.property_kind[] NOT NULL DEFAULT '{}'::public.property_kind[];

UPDATE public.listings SET property_type = CASE
  WHEN title ILIKE '%studio%' THEN 'studio'::public.property_kind
  WHEN title ILIKE '%terrace%' OR title ILIKE '%townhouse%' THEN 'townhouse'::public.property_kind
  WHEN title ILIKE '%house%' OR title ILIKE '%cottage%' THEN 'house'::public.property_kind
  WHEN title ILIKE '%land%' THEN 'land'::public.property_kind
  ELSE 'apartment'::public.property_kind
END;