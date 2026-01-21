-- Add image column to chat_messages table for storing base64 image data
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'image'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN image TEXT;
        CREATE INDEX IF NOT EXISTS idx_chat_messages_image ON chat_messages(image) WHERE image IS NOT NULL;
    END IF;
END $$;
