export function getFieldValue(field, fieldType) {
  switch (fieldType) {
    case 'CHECK_BOX':
    case 'MULTI_SELECT':
      return field.value || [];
    case 'USER_SELECT':
      return (field.value || []).map(u => u.name);
    default:
      return field.value ?? '';
  }
}

export function evaluateSingleCondition(cond, record) {
  const field = record.record[cond.field];
  if (!field) return false;

  const fieldValue = getFieldValue(field, cond.fieldType);
  const condValue  = cond.value;

  switch (cond.operator) {
    case 'equals':
      return String(fieldValue) === String(condValue);
    case 'not_equals':
      return String(fieldValue) !== String(condValue);
    case 'contains':
      if (Array.isArray(fieldValue)) {
        return Array.isArray(condValue)
          ? condValue.every(v => fieldValue.includes(v))
          : fieldValue.includes(condValue);
      }
      return String(fieldValue).includes(String(condValue));
    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return Array.isArray(condValue)
          ? !condValue.some(v => fieldValue.includes(v))
          : !fieldValue.includes(condValue);
      }
      return !String(fieldValue).includes(String(condValue));
    case 'greater_than':
      return Number(fieldValue) > Number(condValue);
    case 'less_than':
      return Number(fieldValue) < Number(condValue);
    case 'is_empty':
      return !fieldValue ||
        (Array.isArray(fieldValue) && fieldValue.length === 0) ||
        fieldValue === '';
    case 'is_not_empty':
      return !!fieldValue &&
        (!Array.isArray(fieldValue) || fieldValue.length > 0) &&
        fieldValue !== '';
    default:
      return false;
  }
}

export function evaluateConditions(rule, record) {
  if (!rule.conditions.length) return false;
  const results = rule.conditions.map(c => evaluateSingleCondition(c, record));
  return rule.logicalOp === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// 有効なルールのうち、指定した画面種別(create/edit/detail)を対象とするものだけを抽出する。
export function rulesForScreen(rules, screenType) {
  return rules.filter(r => r.enabled && r.screens && r.screens[screenType]);
}

// 単一アクション用のルール一覧(非表示用/編集不可用のいずれか)について、
// 画面種別ごとに条件成立状態をフィールド単位でOR集約した { [fieldCode]: boolean } を返す。
// 編集不可ルールは screens.detail を持たない(設定UIで選択肢自体が存在しない)ため、
// detail 画面では自然に空オブジェクトになる。
export function computeActiveFields(rules, record, screenType) {
  const targetRules = rulesForScreen(rules, screenType);
  const fieldState = {};
  targetRules.forEach(rule => {
    if (!rule.targetField) return;
    const isMatch = evaluateConditions(rule, { record });
    fieldState[rule.targetField] = (fieldState[rule.targetField] || false) || isMatch;
  });
  return fieldState;
}

// 入力必須ルール一覧について、画面種別ごとに { [fieldCode]: { required: boolean, message: string } } を返す。
// 複数ルールが同一フィールドを対象にする場合、required は OR 集約し、message は
// 現在条件が成立しているルールのうちカスタムメッセージを持つ最初のものを採用する。
// 入力必須ルールも screens.detail を持たないため detail 画面では自然に空オブジェクトになる。
export function computeRequiredState(rules, record, screenType) {
  const targetRules = rulesForScreen(rules, screenType);
  const result = {};
  targetRules.forEach(rule => {
    if (!rule.targetField) return;
    const isMatch = evaluateConditions(rule, { record });
    const cur = result[rule.targetField] || { required: false, message: '' };
    result[rule.targetField] = {
      required: cur.required || isMatch,
      message:  cur.message || (isMatch ? (rule.message || '') : ''),
    };
  });
  return result;
}

export function isEmptyValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === '' || value === null || value === undefined;
}
