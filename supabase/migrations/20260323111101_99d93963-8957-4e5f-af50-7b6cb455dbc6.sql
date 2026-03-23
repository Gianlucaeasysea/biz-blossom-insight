
CREATE TABLE public.frank_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frank_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read/write frank messages" ON public.frank_chat_messages
  FOR ALL TO anon USING (true) WITH CHECK (true);
