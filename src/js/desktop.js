import { rulesForScreen, computeActiveFields, computeRequiredState, isEmptyValue } from './lib/condition-core.js';

((PLUGIN_ID) => {
  'use strict';

  const LOG = '[入力条件プラグイン]';

  function loadRuleList(key) {
    const conf = kintone.plugin.app.getConfig(PLUGIN_ID);
    if (!conf[key]) return [];
    try {
      return JSON.parse(conf[key]);
    } catch (e) {
      console.error(LOG, `${key} の読み込みに失敗:`, e);
      return [];
    }
  }

  const hideRules     = loadRuleList('hideRules');
  const disableRules  = loadRuleList('disableRules');
  const requiredRules = loadRuleList('requiredRules');

  // 必須違反時のデフォルトメッセージ用にフィールドラベルを先取りしておく。
  const fieldLabelCache = {};
  kintone.api(kintone.api.url('/k/v1/app/form/fields.json', true), 'GET', { app: kintone.app.getId() })
    .then(resp => {
      Object.values(resp.properties).forEach(f => { fieldLabelCache[f.code] = f.label; });
    })
    .catch(() => {});

  function hasAnyRuleForScreen(screenType) {
    return rulesForScreen(hideRules, screenType).length > 0 ||
           rulesForScreen(disableRules, screenType).length > 0 ||
           rulesForScreen(requiredRules, screenType).length > 0;
  }

  function conditionFieldsFor(screenType) {
    const all = [
      ...rulesForScreen(hideRules, screenType),
      ...rulesForScreen(disableRules, screenType),
      ...rulesForScreen(requiredRules, screenType),
    ];
    return [...new Set(all.flatMap(rule => rule.conditions.map(c => c.field)))];
  }

  // show/change いずれのイベントハンドラー内でも kintone.app.record.get()/set() は
  // 呼び出せないため、event.record を直接書き換えて return event することで反映させる。
  function applyToRecord(event, screenType) {
    const hiddenState   = computeActiveFields(hideRules,     event.record, screenType);
    const disabledState = computeActiveFields(disableRules,  event.record, screenType);
    const requiredState = computeRequiredState(requiredRules, event.record, screenType);

    // 非表示/表示は record の外側の状態のため命令的に適用する。
    Object.entries(hiddenState).forEach(([fieldCode, hide]) => {
      kintone.app.record.setFieldShown(fieldCode, !hide);
    });

    Object.entries(disabledState).forEach(([fieldCode, disable]) => {
      const f = event.record[fieldCode];
      if (f) f.disabled = disable;
    });
    Object.entries(requiredState).forEach(([fieldCode, s]) => {
      const f = event.record[fieldCode];
      if (f) f.required = s.required;
    });

    return event;
  }

  // 保存時、入力必須ルールが成立していて対象フィールドが未入力の場合、
  // カスタムメッセージ（未設定時はフィールド名から自動生成）でフィールド単位のエラーを表示し保存をブロックする。
  function applyRequiredValidation(event, screenType) {
    const requiredState = computeRequiredState(requiredRules, event.record, screenType);
    Object.entries(requiredState).forEach(([fieldCode, s]) => {
      if (!s.required) return;
      const f = event.record[fieldCode];
      if (!f) return;
      if (isEmptyValue(f.value)) {
        const label = fieldLabelCache[fieldCode] || fieldCode;
        f.error = s.message || `${label}を入力してください`;
      }
    });
    return event;
  }

  if (!hideRules.length && !disableRules.length && !requiredRules.length) return;

  // ── 初期表示イベント ──────────────────────────────────
  if (hasAnyRuleForScreen('create')) {
    kintone.events.on('app.record.create.show', (event) => applyToRecord(event, 'create'));
  }
  if (hasAnyRuleForScreen('edit')) {
    kintone.events.on(['app.record.edit.show', 'app.record.index.edit.show'],
      (event) => applyToRecord(event, 'edit'));
  }
  if (hasAnyRuleForScreen('detail')) {
    kintone.events.on('app.record.detail.show', (event) => applyToRecord(event, 'detail'));
  }

  // ── 条件フィールドの change イベント ──────────────────
  conditionFieldsFor('create').forEach(fieldCode => {
    kintone.events.on(`app.record.create.change.${fieldCode}`,
      (event) => applyToRecord(event, 'create'));
  });
  conditionFieldsFor('edit').forEach(fieldCode => {
    kintone.events.on([
      `app.record.edit.change.${fieldCode}`,
      `app.record.index.edit.change.${fieldCode}`,
    ], (event) => applyToRecord(event, 'edit'));
  });

  // ── 保存時の入力必須バリデーション ────────────────────
  if (rulesForScreen(requiredRules, 'create').length) {
    kintone.events.on('app.record.create.submit', (event) => applyRequiredValidation(event, 'create'));
  }
  if (rulesForScreen(requiredRules, 'edit').length) {
    kintone.events.on(['app.record.edit.submit', 'app.record.index.edit.submit'],
      (event) => applyRequiredValidation(event, 'edit'));
  }

})(kintone.$PLUGIN_ID);
