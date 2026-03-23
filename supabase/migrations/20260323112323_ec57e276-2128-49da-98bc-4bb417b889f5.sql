
CREATE TABLE public.frank_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Nuova chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frank_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read/write frank conversations" ON public.frank_conversations
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE public.frank_chat_messages
  ADD COLUMN conversation_id uuid REFERENCES public.frank_conversations(id) ON DELETE CASCADE;

CREATE INDEX idx_frank_messages_conversation ON public.frank_chat_messages(conversation_id, created_at);
