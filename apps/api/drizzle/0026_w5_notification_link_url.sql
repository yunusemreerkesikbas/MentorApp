-- W5: add link_url to user_notifications — tapping a notification navigates to this URL.
ALTER TABLE "user_notifications" ADD COLUMN "link_url" text;
