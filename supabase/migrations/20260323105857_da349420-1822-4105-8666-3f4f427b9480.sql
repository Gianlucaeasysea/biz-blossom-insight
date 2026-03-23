
CREATE POLICY "Service role only on bot state" ON public.telegram_bot_state FOR ALL USING (false);
CREATE POLICY "Service role only on messages" ON public.telegram_messages FOR ALL USING (false);
