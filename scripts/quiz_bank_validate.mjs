/**
 * Validate a FordMS quiz bank ({generatedAt, policy, weeks[]}).
 * Returns a list of error strings (empty when the bank is valid).
 *
 * `legacy` (optional) is the week-1 legacy bank that live attempts were scored
 * against; a legacy week must match it item-for-item so existing attempt rows,
 * which store answers index-aligned to that order, stay correct.
 */
export function validateQuizBank(bank, { legacy = null, graded = [1, 3, 4, 6, 7, 9] } = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!bank || typeof bank !== "object") return ["Bank is not an object."];
  if (!Array.isArray(bank.weeks)) return ["Bank has no weeks array."];
  const policy = bank.policy ?? {};
  for (const key of ["draw", "timeLimitMin", "gradedAttempts"]) {
    if (!Number.isInteger(policy[key]) || policy[key] < 1) fail(`policy.${key} must be a positive integer.`);
  }
  const seenWeeks = new Set();
  const seenIds = new Set();
  for (const week of bank.weeks) {
    const label = `Week ${week?.week}`;
    if (!Number.isInteger(week?.week) || week.week < 1 || week.week > 12) {
      fail(`${label}: week must be an integer 1-12.`);
      continue;
    }
    if (seenWeeks.has(week.week)) fail(`${label}: duplicate week.`);
    seenWeeks.add(week.week);
    if (typeof week.title !== "string" || !week.title.trim()) fail(`${label}: missing title.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week.date ?? "")) fail(`${label}: date must be YYYY-MM-DD.`);
    if (typeof week.graded !== "boolean") fail(`${label}: graded must be true or false.`);
    if (week.graded !== graded.includes(week.week)) fail(`${label}: graded=${week.graded} disagrees with the syllabus (graded weeks ${graded.join(", ")}).`);
    for (const key of ["opensAt", "dueAt"]) {
      if (week[key] != null && Number.isNaN(Date.parse(week[key]))) fail(`${label}: ${key} is not a valid timestamp.`);
    }
    if (week.opensAt && week.dueAt && Date.parse(week.opensAt) >= Date.parse(week.dueAt)) fail(`${label}: opensAt must be before dueAt.`);
    if (week.graded && !week.dueAt) fail(`${label}: graded weeks need a dueAt.`);
    if (!week.legacy) {
      if (!week.opensAt) fail(`${label}: non-legacy weeks need an opensAt.`);
      if (!Number.isInteger(week.draw) || week.draw < 1) fail(`${label}: draw must be a positive integer.`);
      if (week.timeLimitMin != null && (!Number.isInteger(week.timeLimitMin) || week.timeLimitMin < 1)) fail(`${label}: timeLimitMin must be a positive integer or null.`);
    }
    if (!Array.isArray(week.items) || !week.items.length) {
      fail(`${label}: no items.`);
      continue;
    }
    const draw = week.legacy ? week.items.length : week.draw ?? policy.draw;
    if (week.items.length < draw) fail(`${label}: pool has ${week.items.length} items but draws ${draw}.`);
    for (const item of week.items) {
      const where = `${label} item ${item?.id}`;
      if (typeof item?.id !== "string" || !item.id) fail(`${label}: an item has no id.`);
      else if (seenIds.has(item.id)) fail(`${where}: duplicate id.`);
      seenIds.add(item?.id);
      if (typeof item?.question !== "string" || !item.question.trim()) fail(`${where}: missing question.`);
      if (!Array.isArray(item?.options) || item.options.length !== 4) fail(`${where}: expected 4 options.`);
      else {
        if (item.options.some((option) => typeof option !== "string" || !option.trim())) fail(`${where}: empty option.`);
        if (new Set(item.options.map((option) => option.trim().toLowerCase())).size !== 4) fail(`${where}: duplicate options.`);
      }
      if (!Number.isInteger(item?.correct) || item.correct < 0 || item.correct > 3) fail(`${where}: correct must be 0-3.`);
      if (typeof item?.rationale !== "string" || !item.rationale.trim()) fail(`${where}: missing rationale.`);
    }
    if (week.legacy && legacy) {
      const expected = legacy.items ?? [];
      const same = expected.length === week.items.length && expected.every((item, index) => {
        const actual = week.items[index];
        return actual.id === item.id && actual.correct === item.correct && JSON.stringify(actual.options) === JSON.stringify(item.options);
      });
      if (!same) fail(`${label}: legacy items differ from the live legacy bank (ids, order, options, or answers). Existing attempts would be mis-scored.`);
    }
  }
  return errors;
}
