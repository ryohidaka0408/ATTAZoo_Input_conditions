((PLUGIN_ID) => {
  'use strict';

  const LOG = '[入力条件プラグイン]';

  // タブ（アクション種別）定義
  const TABS = [
    { key: 'hide',     label: '非表示設定',   configKey: 'hideRules' },
    { key: 'disable',  label: '編集不可設定', configKey: 'disableRules' },
    { key: 'required', label: '入力必須設定', configKey: 'requiredRules' },
  ];

  // 条件フィールドとして選択できる型
  const CONDITION_FIELD_TYPES = [
    'DROP_DOWN', 'RADIO_BUTTON', 'CHECK_BOX', 'MULTI_SELECT',
    'SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT', 'NUMBER', 'USER_SELECT',
    'DATE', 'DATETIME', 'TIME', 'STATUS',
  ];

  // 対象フィールド（非表示/編集不可/入力必須の適用先）として選択できない型
  const EXCLUDED_TARGET_TYPES = [
    'LABEL', 'SPACER', 'HR', 'GROUP', 'SUBTABLE', 'REFERENCE_TABLE',
    'RECORD_NUMBER', 'CREATOR', 'MODIFIER', 'CREATED_TIME', 'UPDATED_TIME', 'CATEGORY',
  ];

  const FIELD_TYPE_LABELS = {
    'DROP_DOWN':        'ドロップダウン',
    'RADIO_BUTTON':     'ラジオボタン',
    'CHECK_BOX':        'チェックボックス',
    'MULTI_SELECT':     '複数選択',
    'SINGLE_LINE_TEXT': '文字列（1行）',
    'MULTI_LINE_TEXT':  '文字列（複数行）',
    'RICH_TEXT':        'リッチエディター',
    'NUMBER':           '数値',
    'CALC':             '計算',
    'LINK':             'リンク',
    'FILE':             '添付ファイル',
    'USER_SELECT':      'ユーザー選択',
    'ORGANIZATION_SELECT': '組織選択',
    'GROUP_SELECT':     'グループ選択',
    'DATE':             '日付',
    'TIME':             '時刻',
    'DATETIME':         '日時',
    'STATUS':           'ステータス',
  };

  function getOperators(fieldType) {
    const base = [
      { value: 'equals',       label: '等しい' },
      { value: 'not_equals',   label: '等しくない' },
      { value: 'is_empty',     label: '空である' },
      { value: 'is_not_empty', label: '空でない' },
    ];
    const contains = [
      { value: 'contains',     label: '含む' },
      { value: 'not_contains', label: '含まない' },
    ];
    const numeric = [
      { value: 'greater_than', label: 'より大きい' },
      { value: 'less_than',    label: 'より小さい' },
    ];
    switch (fieldType) {
      case 'CHECK_BOX':
      case 'MULTI_SELECT':
        return [...contains, ...base];
      case 'SINGLE_LINE_TEXT':
      case 'MULTI_LINE_TEXT':
        return [...base, ...contains];
      case 'NUMBER':
      case 'DATE':
      case 'DATETIME':
      case 'TIME':
        return [...base, ...numeric];
      default:
        return base;
    }
  }

  function generateId() {
    return 'r' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // 詳細画面は「非表示」タブでのみ意味を持つ（編集不可・入力必須は詳細画面では効果がないため
  // それらのタブでは対象画面の選択肢自体を出さない）。
  function createEmptyRule(tab) {
    const rule = {
      id: generateId(),
      label: '',
      targetField: '',
      logicalOp: 'AND',
      conditions: [],
      screens: tab === 'hide'
        ? { create: true, edit: true, detail: true }
        : { create: true, edit: true },
      enabled: true,
    };
    if (tab === 'required') rule.message = '';
    return rule;
  }

  function createEmptyCondition() {
    return {
      id: generateId(),
      field: '',
      fieldType: '',
      operator: 'equals',
      value: '',
    };
  }

  let allFields = {};

  // ── 値入力UIの描画 ────────────────────────────────────
  function renderValueInput(container, fieldType, fieldOptions, currentValue, operator) {
    container.innerHTML = '';

    if (['is_empty', 'is_not_empty'].includes(operator)) return;

    switch (fieldType) {
      case 'DROP_DOWN':
      case 'RADIO_BUTTON':
      case 'STATUS': {
        const sel = document.createElement('select');
        sel.className = 'condition-value-select';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- 選択 --';
        sel.appendChild(emptyOpt);
        Object.keys(fieldOptions || {}).forEach(key => {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = key;
          if (key === currentValue) opt.selected = true;
          sel.appendChild(opt);
        });
        container.appendChild(sel);
        break;
      }
      case 'CHECK_BOX':
      case 'MULTI_SELECT': {
        const currentArr = Array.isArray(currentValue) ? currentValue : [];
        Object.keys(fieldOptions || {}).forEach(key => {
          const label = document.createElement('label');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = key;
          cb.checked = currentArr.includes(key);
          label.appendChild(cb);
          label.appendChild(document.createTextNode(key));
          container.appendChild(label);
        });
        break;
      }
      case 'NUMBER': {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue || '';
        input.placeholder = '数値を入力';
        container.appendChild(input);
        break;
      }
      case 'DATE': {
        const input = document.createElement('input');
        input.type = 'date';
        input.value = currentValue || '';
        container.appendChild(input);
        break;
      }
      case 'TIME': {
        const input = document.createElement('input');
        input.type = 'time';
        input.value = currentValue || '';
        container.appendChild(input);
        break;
      }
      case 'DATETIME': {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.value = currentValue || '';
        container.appendChild(input);
        break;
      }
      default: {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = fieldType === 'USER_SELECT' ? 'ユーザー名を入力' : '値を入力';
        input.value = typeof currentValue === 'string' ? currentValue : '';
        container.appendChild(input);
      }
    }
  }

  // ── 条件行の値を取得 ──────────────────────────────────
  function getConditionValue(valueWrap, fieldType, operator) {
    if (['is_empty', 'is_not_empty'].includes(operator)) return '';
    switch (fieldType) {
      case 'CHECK_BOX':
      case 'MULTI_SELECT': {
        const checked = valueWrap.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checked).map(cb => cb.value);
      }
      default: {
        const el = valueWrap.querySelector('input, select');
        return el ? el.value.trim() : '';
      }
    }
  }

  // ── 条件行の描画 ──────────────────────────────────────
  function renderConditionRow(rule, cond, condContainer) {
    const row = document.createElement('div');
    row.className = 'condition-row';
    row.dataset.condId = cond.id;

    const fieldSel = document.createElement('select');
    fieldSel.className = 'cond-field-sel';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- フィールドを選択 --';
    fieldSel.appendChild(emptyOpt);
    Object.values(allFields).forEach(f => {
      if (!CONDITION_FIELD_TYPES.includes(f.type)) return;
      const opt = document.createElement('option');
      opt.value = f.code;
      opt.dataset.fieldType = f.type;
      opt.textContent = `${f.label} (${FIELD_TYPE_LABELS[f.type] || f.type})`;
      if (f.code === cond.field) opt.selected = true;
      fieldSel.appendChild(opt);
    });

    const opSel = document.createElement('select');
    opSel.className = 'cond-op-sel';

    const valueWrap = document.createElement('div');
    valueWrap.className = 'cond-value-wrap';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = '削除';

    function updateOpAndValue() {
      const selectedOpt = fieldSel.options[fieldSel.selectedIndex];
      const fieldType = selectedOpt ? selectedOpt.dataset.fieldType : '';
      const fieldCode = fieldSel.value;
      const fieldDef = allFields[fieldCode];
      const fieldOptions = fieldDef ? (fieldDef.options || {}) : {};

      opSel.innerHTML = '';
      const operators = getOperators(fieldType);
      operators.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.value;
        opt.textContent = op.label;
        if (op.value === cond.operator) opt.selected = true;
        opSel.appendChild(opt);
      });

      renderValueInput(valueWrap, fieldType, fieldOptions, cond.value, opSel.value);

      opSel.onchange = () => {
        renderValueInput(valueWrap, fieldType, fieldOptions,
          getConditionValue(valueWrap, fieldType, opSel.value), opSel.value);
      };
    }

    if (cond.field) {
      updateOpAndValue();
    } else {
      opSel.innerHTML = '<option value="">--</option>';
    }

    fieldSel.addEventListener('change', () => {
      cond.field = fieldSel.value;
      const selectedOpt = fieldSel.options[fieldSel.selectedIndex];
      cond.fieldType = selectedOpt ? selectedOpt.dataset.fieldType : '';
      cond.operator = 'equals';
      cond.value = '';
      updateOpAndValue();
    });

    delBtn.addEventListener('click', () => {
      const idx = rule.conditions.findIndex(c => c.id === cond.id);
      if (idx !== -1) rule.conditions.splice(idx, 1);
      row.remove();
    });

    row.appendChild(fieldSel);
    row.appendChild(opSel);
    row.appendChild(valueWrap);
    row.appendChild(delBtn);
    condContainer.appendChild(row);
  }

  // ── テスト実行 ────────────────────────────────────────
  function runTest(rule, testPanel, tab) {
    testPanel.innerHTML = '';

    const currentRule = collectRuleFromCard(
      document.querySelector(`.rule-card[data-rule-id="${rule.id}"]`), rule, tab
    );

    if (!currentRule.targetField) {
      testPanel.innerHTML = '<p style="color:#999;font-size:13px;">対象フィールドを選択してください。</p>';
      return;
    }
    if (!currentRule.conditions.length) {
      testPanel.innerHTML = '<p style="color:#999;font-size:13px;">条件を1件以上設定してください。</p>';
      return;
    }

    const form = document.createElement('div');
    form.style.cssText = 'background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;padding:12px;margin-bottom:8px;';

    const screenRow = document.createElement('div');
    screenRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
    const screenLbl = document.createElement('label');
    screenLbl.style.cssText = 'font-size:12px;min-width:120px;';
    screenLbl.textContent = '評価する画面';
    const screenSel = document.createElement('select');
    screenSel.style.cssText = 'font-size:12px;padding:4px;border:1px solid #ddd;border-radius:3px;';
    const screenOptions = tab === 'hide'
      ? [['create', '追加画面'], ['edit', '編集画面'], ['detail', '詳細画面']]
      : [['create', '追加画面'], ['edit', '編集画面']];
    screenOptions.forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (!currentRule.screens[val]) opt.disabled = true;
      screenSel.appendChild(opt);
    });
    screenRow.appendChild(screenLbl);
    screenRow.appendChild(screenSel);
    form.appendChild(screenRow);

    const title = document.createElement('p');
    title.style.cssText = 'font-size:13px;font-weight:500;margin:0 0 8px;';
    title.textContent = '条件フィールドにテスト値を入力してください：';
    form.appendChild(title);

    const testInputs = {};
    currentRule.conditions.forEach(cond => {
      if (!cond.field) return;
      if (testInputs[cond.field]) return;

      const fieldDef = allFields[cond.field];
      if (!fieldDef) return;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';

      const lbl = document.createElement('label');
      lbl.style.cssText = 'font-size:12px;min-width:120px;';
      lbl.textContent = fieldDef.label || cond.field;
      row.appendChild(lbl);

      let input;
      if (['CHECK_BOX', 'MULTI_SELECT'].includes(cond.fieldType)) {
        const wrap = document.createElement('div');
        const opts = fieldDef.options || {};
        Object.keys(opts).forEach(key => {
          const l = document.createElement('label');
          l.style.cssText = 'font-size:12px;margin-right:6px;cursor:pointer;';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = key;
          cb.style.marginRight = '3px';
          l.appendChild(cb);
          l.appendChild(document.createTextNode(key));
          wrap.appendChild(l);
        });
        row.appendChild(wrap);
        testInputs[cond.field] = { type: 'multi', wrap };
      } else if (['DROP_DOWN', 'RADIO_BUTTON', 'STATUS'].includes(cond.fieldType)) {
        input = document.createElement('select');
        input.style.cssText = 'font-size:12px;padding:4px;border:1px solid #ddd;border-radius:3px;';
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '-- 選択 --';
        input.appendChild(empty);
        const opts = fieldDef.options || {};
        Object.keys(opts).forEach(key => {
          const o = document.createElement('option');
          o.value = key;
          o.textContent = key;
          input.appendChild(o);
        });
        row.appendChild(input);
        testInputs[cond.field] = { type: 'single', input };
      } else {
        input = document.createElement('input');
        input.type = cond.fieldType === 'NUMBER' ? 'number' : (cond.fieldType === 'DATE' ? 'date' : 'text');
        input.style.cssText = 'font-size:12px;padding:4px;border:1px solid #ddd;border-radius:3px;';
        row.appendChild(input);
        testInputs[cond.field] = { type: 'single', input };
      }

      form.appendChild(row);
    });

    testPanel.appendChild(form);

    const evalBtn = document.createElement('button');
    evalBtn.type = 'button';
    evalBtn.className = 'btn btn--sm btn--primary';
    evalBtn.textContent = 'この条件を評価';
    testPanel.appendChild(evalBtn);

    const resultDiv = document.createElement('div');
    resultDiv.className = 'test-result';
    resultDiv.style.display = 'none';
    testPanel.appendChild(resultDiv);

    const tabInfo = TABS.find(t => t.key === tab);

    evalBtn.addEventListener('click', () => {
      const mockRecord = {};
      currentRule.conditions.forEach(cond => {
        if (!cond.field) return;
        const ti = testInputs[cond.field];
        if (!ti) return;
        let val;
        if (ti.type === 'multi') {
          val = Array.from(ti.wrap.querySelectorAll('input:checked')).map(cb => cb.value);
          mockRecord[cond.field] = { value: val };
        } else {
          val = ti.input.value;
          if (['USER_SELECT'].includes(cond.fieldType)) {
            mockRecord[cond.field] = { value: val ? [{ name: val }] : [] };
          } else {
            mockRecord[cond.field] = { value: val };
          }
        }
      });

      const fakeRecord = { record: mockRecord };
      let matched;
      try {
        const results = currentRule.conditions.map(cond => {
          const field = fakeRecord.record[cond.field];
          if (!field) return false;
          let fieldValue;
          if (['CHECK_BOX', 'MULTI_SELECT'].includes(cond.fieldType)) {
            fieldValue = field.value || [];
          } else if (cond.fieldType === 'USER_SELECT') {
            fieldValue = (field.value || []).map(u => u.name);
          } else {
            fieldValue = field.value ?? '';
          }
          const cv = cond.value;
          switch (cond.operator) {
            case 'equals': return String(fieldValue) === String(cv);
            case 'not_equals': return String(fieldValue) !== String(cv);
            case 'contains':
              if (Array.isArray(fieldValue)) {
                return Array.isArray(cv) ? cv.every(v => fieldValue.includes(v)) : fieldValue.includes(cv);
              }
              return String(fieldValue).includes(String(cv));
            case 'not_contains':
              if (Array.isArray(fieldValue)) {
                return Array.isArray(cv) ? !cv.some(v => fieldValue.includes(v)) : !fieldValue.includes(cv);
              }
              return !String(fieldValue).includes(String(cv));
            case 'greater_than': return Number(fieldValue) > Number(cv);
            case 'less_than': return Number(fieldValue) < Number(cv);
            case 'is_empty': return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0) || fieldValue === '';
            case 'is_not_empty': return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0) && fieldValue !== '';
            default: return false;
          }
        });
        matched = currentRule.logicalOp === 'AND' ? results.every(Boolean) : results.some(Boolean);
      } catch (e) {
        matched = false;
      }

      const screenType = screenSel.value;
      const inScope = currentRule.screens[screenType];
      resultDiv.style.display = 'block';

      if (!inScope) {
        resultDiv.className = 'test-result no-match';
        resultDiv.textContent = `このルールは「${screenSel.options[screenSel.selectedIndex].textContent}」では対象外です。`;
        return;
      }

      resultDiv.className = matched ? 'test-result match' : 'test-result no-match';
      if (!matched) {
        resultDiv.textContent = '条件が成立しません。通常の状態のままです。';
        return;
      }

      if (tab === 'required') {
        const fieldLabel = allFields[currentRule.targetField]
          ? allFields[currentRule.targetField].label
          : currentRule.targetField;
        const message = currentRule.message || `${fieldLabel}を入力してください`;
        resultDiv.textContent = `条件が成立します。「${tabInfo.label}」が適用されます。対象フィールドが未入力のまま保存しようとすると次のメッセージが表示されます：「${message}」`;
      } else {
        resultDiv.textContent = `条件が成立します。「${tabInfo.label}」が適用されます。`;
      }
    });
  }

  // ── ルールカードからデータを収集 ──────────────────────
  function collectRuleFromCard(card, ruleRef, tab) {
    if (!card) return ruleRef;

    const label = card.querySelector('.rule-name-input').value.trim();
    const enabled = card.querySelector('.rule-enabled-toggle').checked;
    const targetSel = card.querySelector('.target-field-sel');
    const targetField = targetSel ? targetSel.value : '';
    const logicalOp = card.querySelector('.logical-op-and').checked ? 'AND' : 'OR';

    const condRows = card.querySelectorAll('.condition-row');
    const conditions = [];
    condRows.forEach(row => {
      const fieldSel = row.querySelector('.cond-field-sel');
      const opSel = row.querySelector('.cond-op-sel');
      const valueWrap = row.querySelector('.cond-value-wrap');
      const condId = row.dataset.condId;
      if (!fieldSel || !opSel) return;

      const field = fieldSel.value;
      const selectedFieldOpt = fieldSel.options[fieldSel.selectedIndex];
      const fieldType = selectedFieldOpt ? selectedFieldOpt.dataset.fieldType : '';
      const operator = opSel.value;

      let value;
      if (['is_empty', 'is_not_empty'].includes(operator)) {
        value = '';
      } else if (['CHECK_BOX', 'MULTI_SELECT'].includes(fieldType)) {
        const checked = valueWrap.querySelectorAll('input[type="checkbox"]:checked');
        value = Array.from(checked).map(cb => cb.value);
      } else {
        const el = valueWrap.querySelector('input, select');
        value = el ? el.value.trim() : '';
      }

      conditions.push({ id: condId || generateId(), field, fieldType, operator, value });
    });

    const screens = {
      create: card.querySelector('.screen-create-cb').checked,
      edit:   card.querySelector('.screen-edit-cb').checked,
    };
    if (tab === 'hide') {
      screens.detail = card.querySelector('.screen-detail-cb').checked;
    }

    const result = {
      id: ruleRef.id,
      label,
      targetField,
      logicalOp,
      conditions,
      screens,
      enabled,
    };

    if (tab === 'required') {
      const msgInput = card.querySelector('.rule-message-input');
      result.message = msgInput ? msgInput.value.trim() : '';
    }

    return result;
  }

  // ── 指定コンテナ配下の全ルールをUIから収集 ─────────────
  function collectRulesFromContainer(containerId, tab) {
    const cards = document.querySelectorAll(`#${containerId} .rule-card`);
    const result = [];
    cards.forEach(card => {
      const ruleId = card.dataset.ruleId;
      const dummyRule = { id: ruleId };
      result.push(collectRuleFromCard(card, dummyRule, tab));
    });
    return result;
  }

  // ── バリデーション ────────────────────────────────────
  function validateRules(rules, tabLabel, tabKey) {
    const screenLabel = tabKey === 'hide' ? '（追加・編集・詳細）' : '（追加・編集）';
    for (const rule of rules) {
      const name = rule.label || '(名前未設定)';
      const prefix = `「${tabLabel}」ルール「${name}」`;
      if (!rule.targetField) return `${prefix}: 対象フィールドを選択してください`;
      if (!rule.conditions.length) return `${prefix}: 条件を1件以上設定してください`;
      const noScreenSelected = tabKey === 'hide'
        ? (!rule.screens.create && !rule.screens.edit && !rule.screens.detail)
        : (!rule.screens.create && !rule.screens.edit);
      if (noScreenSelected) {
        return `${prefix}: 対象画面${screenLabel}のいずれか1つ以上を選択してください`;
      }
      for (const cond of rule.conditions) {
        if (!cond.field) return `${prefix}: 条件フィールドを選択してください`;
        if (!['is_empty', 'is_not_empty'].includes(cond.operator)) {
          const val = cond.value;
          if (!val || (Array.isArray(val) && val.length === 0)) {
            return `${prefix}: 条件の値を入力してください`;
          }
        }
      }
    }
    return null;
  }

  function showError(message) {
    const area = document.getElementById('error-area');
    area.textContent = message;
    area.style.display = 'block';
    area.scrollIntoView({ behavior: 'smooth' });
  }

  function hideError() {
    const area = document.getElementById('error-area');
    area.style.display = 'none';
  }

  function saveConfig() {
    const collected = {};
    for (const tab of TABS) {
      const rules = collectRulesFromContainer(`rules-container-${tab.key}`, tab.key);
      const error = validateRules(rules, tab.label, tab.key);
      if (error) {
        showError(error);
        return;
      }
      collected[tab.configKey] = JSON.stringify(rules);
    }
    hideError();
    kintone.plugin.app.setConfig(
      collected,
      () => {
        alert('設定を保存しました。アプリを更新してください。');
        history.back();
      }
    );
  }

  // ── ルールカードの描画 ────────────────────────────────
  function renderRuleCard(rule, tab) {
    const container = document.getElementById(`rules-container-${tab}`);
    const tabInfo = TABS.find(t => t.key === tab);
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.dataset.ruleId = rule.id;

    // ヘッダー
    const header = document.createElement('div');
    header.className = 'rule-card-header';

    const toggleArrow = document.createElement('span');
    toggleArrow.className = 'rule-card-toggle';
    toggleArrow.textContent = '▼';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'rule-name-input';
    nameInput.placeholder = `ルール名（例：${tabInfo.label}の条件）`;
    nameInput.value = rule.label || '';

    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'toggle-wrap';
    const toggleSpan = document.createElement('span');
    toggleSpan.textContent = '有効';
    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.className = 'rule-enabled-toggle';
    toggleInput.checked = rule.enabled !== false;
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(toggleSlider);
    toggleWrap.appendChild(toggleSpan);
    toggleWrap.appendChild(toggleLabel);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = '削除';

    header.appendChild(toggleArrow);
    header.appendChild(nameInput);
    header.appendChild(toggleWrap);
    header.appendChild(delBtn);
    card.appendChild(header);

    // ボディ
    const body = document.createElement('div');
    body.className = 'rule-card-body';
    card.appendChild(body);

    toggleArrow.addEventListener('click', () => {
      const collapsed = body.classList.toggle('hidden');
      toggleArrow.textContent = collapsed ? '▶' : '▼';
      header.classList.toggle('collapsed', collapsed);
    });

    delBtn.addEventListener('click', () => {
      card.remove();
    });

    // ── 対象フィールド
    const targetSection = document.createElement('div');
    targetSection.className = 'form-row';
    const targetLabel = document.createElement('div');
    targetLabel.className = 'form-label';
    targetLabel.textContent = '対象フィールド';
    const targetFieldWrap = document.createElement('div');
    targetFieldWrap.className = 'form-field';
    const targetSel = document.createElement('select');
    targetSel.className = 'target-field-sel';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- フィールドを選択 --';
    targetSel.appendChild(emptyOpt);
    Object.values(allFields).forEach(f => {
      if (EXCLUDED_TARGET_TYPES.includes(f.type)) return;
      const opt = document.createElement('option');
      opt.value = f.code;
      opt.dataset.fieldType = f.type;
      opt.textContent = `${f.label} (${FIELD_TYPE_LABELS[f.type] || f.type})`;
      if (f.code === rule.targetField) opt.selected = true;
      targetSel.appendChild(opt);
    });
    targetFieldWrap.appendChild(targetSel);
    targetSection.appendChild(targetLabel);
    targetSection.appendChild(targetFieldWrap);
    body.appendChild(targetSection);

    // ── 論理演算子
    const logicSection = document.createElement('div');
    logicSection.className = 'form-row';
    const logicLabel = document.createElement('div');
    logicLabel.className = 'form-label';
    logicLabel.textContent = '条件の論理演算';
    const logicField = document.createElement('div');
    logicField.className = 'form-field';
    const logicGroup = document.createElement('div');
    logicGroup.className = 'logical-op-group';
    ['AND', 'OR'].forEach(op => {
      const l = document.createElement('label');
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = `logical-op-${rule.id}`;
      r.value = op;
      r.className = op === 'AND' ? 'logical-op-and' : 'logical-op-or';
      r.checked = (rule.logicalOp || 'AND') === op;
      l.appendChild(r);
      l.appendChild(document.createTextNode(op === 'AND' ? ' AND（すべて満たす）' : ' OR（いずれか満たす）'));
      logicGroup.appendChild(l);
    });
    logicField.appendChild(logicGroup);
    logicSection.appendChild(logicLabel);
    logicSection.appendChild(logicField);
    body.appendChild(logicSection);

    // ── 条件セクション
    const condSectionLabel = document.createElement('div');
    condSectionLabel.className = 'section-label';
    condSectionLabel.textContent = '条件';
    body.appendChild(condSectionLabel);

    const condContainer = document.createElement('div');
    condContainer.className = 'conditions-container';
    body.appendChild(condContainer);

    (rule.conditions || []).forEach(cond => {
      renderConditionRow(rule, cond, condContainer);
    });

    const addCondBtn = document.createElement('button');
    addCondBtn.type = 'button';
    addCondBtn.className = 'btn btn--link';
    addCondBtn.textContent = '＋ 条件を追加';
    addCondBtn.addEventListener('click', () => {
      const newCond = createEmptyCondition();
      rule.conditions.push(newCond);
      renderConditionRow(rule, newCond, condContainer);
    });
    body.appendChild(addCondBtn);

    // ── 対象画面
    const screenSectionLabel = document.createElement('div');
    screenSectionLabel.className = 'section-label';
    screenSectionLabel.textContent = '対象画面（このルールを有効にする画面）';
    body.appendChild(screenSectionLabel);

    const screenRow = document.createElement('div');
    screenRow.className = 'checkbox-row';

    function makeCheckbox(cls, checked, text) {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = cls;
      cb.checked = checked;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(text));
      return { label, cb };
    }

    const createCb = makeCheckbox('screen-create-cb', rule.screens.create, '追加画面');
    const editCb   = makeCheckbox('screen-edit-cb',   rule.screens.edit,   '編集画面');
    screenRow.appendChild(createCb.label);
    screenRow.appendChild(editCb.label);
    // 詳細画面は「非表示」タブでのみ意味を持つため、他タブでは選択肢自体を出さない
    // （編集不可・入力必須は詳細画面が編集不可のため常に無効）。
    if (tab === 'hide') {
      const detailCb = makeCheckbox('screen-detail-cb', rule.screens.detail, '詳細画面');
      screenRow.appendChild(detailCb.label);
    }
    body.appendChild(screenRow);

    // ── 未入力時のメッセージ（入力必須タブのみ）
    if (tab === 'required') {
      const msgSection = document.createElement('div');
      msgSection.className = 'form-row';
      const msgLabel = document.createElement('div');
      msgLabel.className = 'form-label';
      msgLabel.textContent = '未入力時のメッセージ';
      const msgFieldWrap = document.createElement('div');
      msgFieldWrap.className = 'form-field';
      const msgInput = document.createElement('input');
      msgInput.type = 'text';
      msgInput.className = 'rule-message-input';
      msgInput.placeholder = '未設定の場合「(フィールド名)を入力してください」を表示';
      msgInput.value = rule.message || '';
      const msgHint = document.createElement('p');
      msgHint.style.cssText = 'font-size:11px;color:#888;margin:4px 0 0;line-height:1.5;';
      msgHint.textContent = '条件成立時に対象フィールドが未入力のまま保存しようとすると、このメッセージがフィールド直下に表示され保存がブロックされます。';
      msgFieldWrap.appendChild(msgInput);
      msgFieldWrap.appendChild(msgHint);
      msgSection.appendChild(msgLabel);
      msgSection.appendChild(msgFieldWrap);
      body.appendChild(msgSection);
    }

    // ── テスト実行
    const testSectionLabel = document.createElement('div');
    testSectionLabel.className = 'section-label';
    testSectionLabel.style.marginTop = '16px';
    testSectionLabel.textContent = 'テスト実行';
    body.appendChild(testSectionLabel);

    const testBtn = document.createElement('button');
    testBtn.type = 'button';
    testBtn.className = 'btn btn--sm';
    testBtn.textContent = 'テスト実行';
    body.appendChild(testBtn);

    const testPanel = document.createElement('div');
    testPanel.style.marginTop = '8px';
    body.appendChild(testPanel);

    testBtn.addEventListener('click', () => {
      runTest(rule, testPanel, tab);
    });

    container.appendChild(card);
  }

  function renderTab(tab, rules) {
    document.getElementById(`rules-container-${tab}`).innerHTML = '';
    rules.forEach(rule => renderRuleCard(rule, tab));
  }

  // ── タブ切り替え ──────────────────────────────────────
  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.style.display = panel.dataset.tabPanel === target ? '' : 'none';
        });
      });
    });
  }

  // ── 初期化（kintoneはDOMContentLoaded後にJSを読み込むため直接実行）
  (async () => {
    try {
      const fieldsResp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET', { app: kintone.app.getId(), lang: 'ja' }
      );
      allFields = fieldsResp.properties;
    } catch (e) {
      console.error(LOG, 'フィールド一覧取得失敗:', e);
      allFields = {};
    }

    const conf = kintone.plugin.app.getConfig(PLUGIN_ID);

    setupTabs();

    for (const tab of TABS) {
      let rules = [];
      if (conf[tab.configKey]) {
        try { rules = JSON.parse(conf[tab.configKey]); } catch (e) { rules = []; }
      }
      renderTab(tab.key, rules);

      document.getElementById(`add-rule-btn-${tab.key}`).addEventListener('click', () => {
        const newRule = createEmptyRule(tab.key);
        renderRuleCard(newRule, tab.key);
      });
    }

    document.getElementById('save-btn').addEventListener('click', saveConfig);

    document.getElementById('cancel-btn').addEventListener('click', () => {
      history.back();
    });
  })();

})(kintone.$PLUGIN_ID);
