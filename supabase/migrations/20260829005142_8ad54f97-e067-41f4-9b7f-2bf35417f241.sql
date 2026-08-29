CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  suburb TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TYPE public.deal_kind AS ENUM ('rent', 'buy');

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deal public.deal_kind NOT NULL DEFAULT 'rent',
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  postcode TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  price_cents BIGINT NOT NULL DEFAULT 0,
  bedrooms INT NOT NULL DEFAULT 1,
  bathrooms INT NOT NULL DEFAULT 1,
  parking INT NOT NULL DEFAULT 0,
  area_sqm INT,
  description TEXT NOT NULL DEFAULT '',
  features TEXT[] NOT NULL DEFAULT '{}',
  cover_url TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_public_read" ON public.listings FOR SELECT USING (published = true);
CREATE POLICY "listings_owner_read" ON public.listings FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "listings_owner_insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_update" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_delete" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.listing_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_photos TO authenticated;
GRANT ALL ON public.listing_photos TO service_role;
ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_photos_public_read" ON public.listing_photos FOR SELECT USING (true);
CREATE POLICY "listing_photos_owner_write" ON public.listing_photos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid()));

CREATE TABLE public.wanted_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deal public.deal_kind NOT NULL DEFAULT 'rent',
  title TEXT NOT NULL,
  suburbs TEXT[] NOT NULL DEFAULT '{}',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  budget_cents BIGINT NOT NULL DEFAULT 0,
  bedrooms_min INT NOT NULL DEFAULT 1,
  must_haves TEXT[] NOT NULL DEFAULT '{}',
  move_in_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wanted_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wanted_ads TO authenticated;
GRANT ALL ON public.wanted_ads TO service_role;
ALTER TABLE public.wanted_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wanted_public_read" ON public.wanted_ads FOR SELECT USING (true);
CREATE POLICY "wanted_owner_insert" ON public.wanted_ads FOR INSERT TO authenticated WITH CHECK (auth.uid() = seeker_id);
CREATE POLICY "wanted_owner_update" ON public.wanted_ads FOR UPDATE TO authenticated USING (auth.uid() = seeker_id) WITH CHECK (auth.uid() = seeker_id);
CREATE POLICY "wanted_owner_delete" ON public.wanted_ads FOR DELETE TO authenticated USING (auth.uid() = seeker_id);
CREATE TRIGGER wanted_updated_at BEFORE UPDATE ON public.wanted_ads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wanted_ad_id UUID NOT NULL REFERENCES public.wanted_ads(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wanted_ad_id, listing_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_parties_read" ON public.applications FOR SELECT TO authenticated
USING (auth.uid() = applicant_id OR EXISTS (SELECT 1 FROM public.wanted_ads w WHERE w.id = wanted_ad_id AND w.seeker_id = auth.uid()));
CREATE POLICY "applications_applicant_insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "applications_seeker_update" ON public.applications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wanted_ads w WHERE w.id = wanted_ad_id AND w.seeker_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.wanted_ads w WHERE w.id = wanted_ad_id AND w.seeker_id = auth.uid()));
CREATE POLICY "applications_applicant_delete" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = applicant_id);
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  wanted_ad_id UUID REFERENCES public.wanted_ads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comments_one_target CHECK (num_nonnulls(listing_id, wanted_ad_id) = 1)
);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_author_insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_author_update" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_author_delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  wanted_ad_id UUID REFERENCES public.wanted_ads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_one_target CHECK (num_nonnulls(listing_id, wanted_ad_id) = 1)
);
GRANT SELECT, INSERT, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_own" ON public.saved_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "property_photos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'property-photos');
CREATE POLICY "property_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "property_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "property_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.listings (deal, title, address, suburb, postcode, lat, lng, price_cents, bedrooms, bathrooms, parking, area_sqm, description, features, cover_url) VALUES
('rent', 'Beachside two-bedder with balcony', '2/14 Cope Street', 'Bondi', '2026', -33.8915, 151.2767, 155000, 2, 2, 1, 78, 'Light-filled apartment 120 m from the sand. Sunny north-facing balcony, internal laundry and a secure garage space.', ARRAY['Balcony','Secure parking','Internal laundry','Pet friendly'], '/demo/bondi.jpg'),
('rent', 'Brick terrace off Crown Street', '48 Bourke Street', 'Surry Hills', '2010', -33.8845, 151.2118, 138000, 1, 1, 0, 55, 'Classic Surry Hills terrace with original fireplace, courtyard and a quiet study nook. Steps to Crown Street cafes.', ARRAY['Courtyard','Heritage features','Study nook'], '/demo/surry-hills.jpg'),
('rent', 'Ground-floor flat near King Street', '3/91 Wilson Street', 'Newtown', '2042', -33.8983, 151.1793, 129000, 2, 1, 1, 66, 'Renovated ground-floor flat with a private garden strip, walkable to King Street and Newtown station.', ARRAY['Garden','Renovated kitchen','Walk to station'], '/demo/newtown.jpg'),
('rent', 'Harbour-view apartment above the Corso', '11/5 Whistler Street', 'Manly', '2095', -33.7969, 151.2874, 172000, 2, 2, 1, 84, 'Top-floor apartment with harbour glimpses, wraparound balcony and lift access. Ferry is a six minute walk.', ARRAY['Harbour views','Lift','Balcony','Air conditioning'], '/demo/manly.jpg'),
('buy', 'Federation semi with rear studio', '27 Alfred Street', 'Glebe', '2037', -33.8794, 151.1866, 189500000, 3, 2, 1, 142, 'Beautifully kept Federation semi with a converted rear studio, north-facing courtyard and lane access.', ARRAY['Studio','Lane access','Original details'], '/demo/glebe.jpg'),
('buy', 'Paddington terrace with roof deck', '9 Cascade Street', 'Paddington', '2021', -33.8859, 151.2276, 254000000, 3, 2, 1, 160, 'Three-level terrace with a private roof deck looking across the rooftops to the city.', ARRAY['Roof deck','City views','Wine cellar'], '/demo/paddington.jpg');

INSERT INTO public.wanted_ads (deal, title, suburbs, lat, lng, budget_cents, bedrooms_min, must_haves, move_in_date, notes) VALUES
('rent', 'Furnished 2-3 bed, pet friendly', ARRAY['Glebe','Paddington','Newtown'], -33.8794, 151.1866, 145000, 2, ARRAY['Lock-up garage','Pet friendly','Furnished'], '2026-10-01', 'Couple with one small dog, both work from home two days a week. Happy to sign a 24 month lease.'),
('rent', 'Beach-close 3 bed for a family', ARRAY['Manly','Freshwater','Curl Curl'], -33.7969, 151.2874, 195000, 3, ARRAY['Off-street parking','Fenced yard'], '2026-11-15', 'Family of four relocating from Melbourne. School catchment matters more than a new kitchen.'),
('buy', 'First home under $1.3M, inner west', ARRAY['Marrickville','Dulwich Hill','Newtown'], -33.9106, 151.1552, 130000000, 2, ARRAY['Outdoor space','Within 1km of a station'], NULL, 'Pre-approved and ready to move quickly. Would consider something that needs cosmetic work.');