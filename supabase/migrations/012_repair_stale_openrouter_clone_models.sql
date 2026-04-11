UPDATE configurations
SET
  model_provider = 'openrouter',
  model_name = 'qwen/qwen3.5-9b',
  fallback_model = CASE
    WHEN fallback_model IS NULL OR btrim(fallback_model) = ''
      THEN 'gemini-2.5-flash-lite'
    ELSE fallback_model
  END,
  config_hash = NULL
WHERE coalesce(is_frozen, false) = false
  AND model_provider = 'openrouter'
  AND model_name = ANY(
    ARRAY[
      'qwen/qwen3-4b:free',
      'openai/gpt-oss-20b:free',
      'openai/gpt-oss-20b'
    ]::text[]
  )
  AND (
    preset_id = 'small-cheap'
    OR lower(coalesce(name, '')) LIKE '%small cheap%'
    OR lower(coalesce(name, '')) LIKE '%openrouter%'
    OR lower(coalesce(name, '')) LIKE '%hybirdopenrouter%'
  );
