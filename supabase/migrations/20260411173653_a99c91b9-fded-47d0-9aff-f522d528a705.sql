-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- People table
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read people" ON public.people FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert people" ON public.people FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update people" ON public.people FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete people" ON public.people FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Person identifiers
CREATE TABLE public.person_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('primary_phone', 'alternate_phone', 'wallet', 'bank_account')),
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_person_identifiers_normalized ON public.person_identifiers(normalized_value);

ALTER TABLE public.person_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read identifiers" ON public.person_identifiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert identifiers" ON public.person_identifiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update identifiers" ON public.person_identifiers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete identifiers" ON public.person_identifiers FOR DELETE TO authenticated USING (true);

-- Transfer screenshots
CREATE TABLE public.transfer_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  image_fingerprint TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'extracted', 'error')),
  extraction_provider TEXT,
  extraction_error TEXT,
  raw_ocr_text TEXT,
  cleaned_visible_message TEXT,
  transfer_summary_text TEXT,
  raw_provider_response JSONB,
  extracted_phone_raw TEXT,
  extracted_phone_normalized TEXT,
  extracted_amount NUMERIC(12,2),
  service_fee NUMERIC(12,2),
  currency TEXT DEFAULT 'EGP',
  matched_person_id UUID REFERENCES public.people(id),
  matched_identifier_id UUID REFERENCES public.person_identifiers(id),
  matched_identifier_type TEXT,
  match_confidence INTEGER,
  match_type TEXT,
  auto_matched BOOLEAN DEFAULT false,
  accounting_status TEXT DEFAULT 'pending' CHECK (accounting_status IN ('pending', 'approved', 'rejected', 'duplicate_review')),
  approved_amount NUMERIC(12,2),
  reject_reason TEXT,
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ts_phone ON public.transfer_screenshots(extracted_phone_normalized);
CREATE INDEX idx_ts_person ON public.transfer_screenshots(matched_person_id);
CREATE INDEX idx_ts_accounting ON public.transfer_screenshots(accounting_status);
CREATE INDEX idx_ts_created ON public.transfer_screenshots(created_at DESC);
CREATE INDEX idx_ts_fingerprint ON public.transfer_screenshots(image_fingerprint);

ALTER TABLE public.transfer_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read screenshots" ON public.transfer_screenshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert screenshots" ON public.transfer_screenshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update screenshots" ON public.transfer_screenshots FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_screenshots_updated_at BEFORE UPDATE ON public.transfer_screenshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Screenshot duplicates
CREATE TABLE public.screenshot_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES public.transfer_screenshots(id) ON DELETE CASCADE,
  duplicate_of_id UUID NOT NULL REFERENCES public.transfer_screenshots(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.screenshot_duplicates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read duplicates" ON public.screenshot_duplicates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert duplicates" ON public.screenshot_duplicates FOR INSERT TO authenticated WITH CHECK (true);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit log" ON public.audit_log FOR SELECT TO authenticated USING (true);
-- Allow the trigger function to insert audit logs
CREATE POLICY "System can insert audit logs" ON public.audit_log FOR INSERT WITH CHECK (true);

-- Audit trigger for transfer_screenshots
CREATE OR REPLACE FUNCTION public.audit_transfer_screenshots()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.accounting_status IS DISTINCT FROM NEW.accounting_status OR
     OLD.approved_amount IS DISTINCT FROM NEW.approved_amount OR
     OLD.matched_person_id IS DISTINCT FROM NEW.matched_person_id OR
     OLD.reject_reason IS DISTINCT FROM NEW.reject_reason THEN
    INSERT INTO public.audit_log (entity_type, entity_id, action, old_value, new_value, performed_by)
    VALUES (
      'transfer_screenshot',
      NEW.id,
      CASE
        WHEN OLD.accounting_status IS DISTINCT FROM NEW.accounting_status THEN 'status_change'
        WHEN OLD.approved_amount IS DISTINCT FROM NEW.approved_amount THEN 'amount_change'
        WHEN OLD.matched_person_id IS DISTINCT FROM NEW.matched_person_id THEN 'match_change'
        ELSE 'update'
      END,
      jsonb_build_object('accounting_status', OLD.accounting_status, 'approved_amount', OLD.approved_amount, 'matched_person_id', OLD.matched_person_id, 'reject_reason', OLD.reject_reason),
      jsonb_build_object('accounting_status', NEW.accounting_status, 'approved_amount', NEW.approved_amount, 'matched_person_id', NEW.matched_person_id, 'reject_reason', NEW.reject_reason),
      NEW.reviewed_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_transfer_screenshots_trigger
  AFTER UPDATE ON public.transfer_screenshots
  FOR EACH ROW EXECUTE FUNCTION public.audit_transfer_screenshots();

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('transfer-screenshots', 'transfer-screenshots', true);

CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'transfer-screenshots');

CREATE POLICY "Anyone can view screenshots" ON storage.objects
  FOR SELECT USING (bucket_id = 'transfer-screenshots');