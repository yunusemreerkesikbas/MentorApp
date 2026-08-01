ALTER TABLE "coach_memory_facts" ADD CONSTRAINT "coach_memory_facts_key_chk" CHECK ("coach_memory_facts"."key" in ('STUDY_TIME', 'RESPONSE_PREFERENCE', 'CHALLENGE_CATEGORY', 'PRIORITY_SUBJECT'));--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_values_chk" CHECK ((
        "coach_profiles"."calibration_status" in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')
        and "coach_profiles"."memory_consent" in ('PENDING', 'GRANTED', 'DECLINED')
        and ("coach_profiles"."support_preference" is null or "coach_profiles"."support_preference" in ('EMOTIONAL', 'BALANCED', 'ACTION'))
        and ("coach_profiles"."directness_preference" is null or "coach_profiles"."directness_preference" in ('GENTLE', 'BALANCED', 'DIRECT'))
      ));