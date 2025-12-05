document.addEventListener('DOMContentLoaded', () => {
  const stepHost = document.getElementById('stepHost');
  const stepsEls = Array.from(document.querySelectorAll('.q'));
  const bar = document.getElementById('bar');
  const stepText = document.getElementById('stepText');
  const statusEl = document.getElementById('status');
  const doneView = document.getElementById('done');
  const doneTitle = document.querySelector('#done h2');
  const doneSub = document.querySelector('#done p.sub');
  const again = document.getElementById('again');
  const miniStats = document.getElementById('miniStats');
  const statsMeta = document.getElementById('statsMeta');

  const I18N = {
    es: {
      defaultTitle: 'Encuesta',
      selectLanguageTitle: 'Selecciona un idioma',
      selectLanguageSubtitle: 'Elige cómo prefieres responder.',
      stepLabel: (current, total) => `Paso ${current} de ${total}`,
      completed: 'Completado',
      back: 'Volver',
      next: 'Siguiente',
      submit: 'Enviar',
      doneTitle: '¡Gracias!',
      doneSub: 'Tu respuesta ha sido enviada.',
      again: 'Responder otra vez',
      statsMeta: 'Cargando datos…',
      statsEmpty: 'Aún no hay datos suficientes.',
      statsError: 'No se pudieron cargar los datos.',
      statsAge: 'Edades',
      statsGender: 'Género',
      statsRating: 'Valoración de la exposición',
      statsCharacter: 'Personaje favorito',
      statsCount: n => n === 1 ? '1 respuesta recibida' : `${n} respuestas recibidas`,
      statusRequired: 'Completa este paso para continuar.',
      statusSending: 'Enviando…',
      statusError: 'Sin conexión. Inténtalo de nuevo.'
    },
    eu: {
      defaultTitle: 'Inkesta',
      selectLanguageTitle: 'Hautatu hizkuntza',
      selectLanguageSubtitle: 'Aukeratu nola erantzun nahi duzun.',
      stepLabel: (current, total) => `Urratsa ${current} / ${total}`,
      completed: 'Amaituta',
      back: 'Itzuli',
      next: 'Hurrengoa',
      submit: 'Bidali',
      doneTitle: 'Eskerrik asko!',
      doneSub: 'Zure erantzuna bidali da.',
      again: 'Erantzun berriro',
      statsMeta: 'Datuak kargatzen…',
      statsEmpty: 'Oraindik ez dago nahikoa datu.',
      statsError: 'Ezin izan dira datuak kargatu.',
      statsAge: 'Adinak',
      statsGender: 'Generoa',
      statsRating: 'Erakusketaren balorazioa',
      statsCharacter: 'Pertsonaia gogokoa',
      statsCount: n => n === 1 ? 'Erantzun 1 jaso da' : `${n} erantzun jaso dira`,
      statusRequired: 'Osatu urrats hau jarraitzeko.',
      statusSending: 'Bidaltzen…',
      statusError: 'Konexiorik gabe. Saiatu berriro.'
    },
    en: {
      defaultTitle: 'Survey',
      selectLanguageTitle: 'Choose a language',
      selectLanguageSubtitle: 'Pick how you want to answer.',
      stepLabel: (current, total) => `Step ${current} of ${total}`,
      completed: 'Completed',
      back: 'Back',
      next: 'Next',
      submit: 'Submit',
      doneTitle: 'Thank you!',
      doneSub: 'Your response has been sent.',
      again: 'Answer again',
      statsMeta: 'Loading data…',
      statsEmpty: 'Not enough data yet.',
      statsError: 'Could not load data.',
      statsAge: 'Age',
      statsGender: 'Gender',
      statsRating: 'Exhibition rating',
      statsCharacter: 'Favorite character',
      statsCount: n => n === 1 ? '1 response collected' : `${n} responses collected`,
      statusRequired: 'Please complete this step to continue.',
      statusSending: 'Sending…',
      statusError: 'No connection. Please try again.'
    }
  };

  const languagePrompt = `${I18N.eu.selectLanguageTitle} / ${I18N.es.selectLanguageTitle} / ${I18N.en.selectLanguageTitle}`;

  let cfg = null;
  let stepsByLang = {};
  let currentLang = null;
  let locale = I18N.es;
  let activeSteps = [];
  let stepIndex = 0;
  let TOTAL_STEPS = 0;
  let answers = {};
  let surveyId = 1;
  const stepIndexById = new Map();
  const prevSteps = [];
  const questionLabels = {};
  const genderLabelMap = {
    es: {
      man: 'Hombre',
      woman: 'Mujer',
      nonbinary: 'No binario',
      otro: 'Otro',
      other: 'Otro',
      prefiero_no_decir: 'Prefiero no decir',
      no_responde: 'No responde'
    },
    eu: {
      man: 'Gizona',
      woman: 'Emakumea',
      nonbinary: 'Ez bitarra',
      otro: 'Beste bat',
      other: 'Beste bat',
      prefiero_no_decir: 'Ez dut esan nahi',
      no_responde: 'Erantzunik ez'
    },
    en: {
      man: 'Man',
      woman: 'Woman',
      nonbinary: 'Non-binary',
      otro: 'Other',
      other: 'Other',
      prefiero_no_decir: 'Prefer not to say',
      no_responde: 'No answer'
    }
  };
  const genderColors = {
    man: '#6da7ff',
    woman: '#f8a1d1',
    nonbinary: '#9b7df0',
    otro: '#ffcf5c',
    other: '#ffcf5c',
    prefiero_no_decir: '#a0a0a0',
    no_responde: '#a0a0a0'
  };
  const ageBuckets = [
    { key: '10_17', label: '10-17', color: '#6da7ff' },
    { key: '18_25', label: '18-25', color: '#f8a1d1' },
    { key: '26_35', label: '26-35', color: '#ffcf5c' },
    { key: '36_45', label: '36-45', color: '#9b7df0' },
    { key: '46_55', label: '46-55', color: '#66d399' },
    { key: '56_65', label: '56-65', color: '#ffa45c' },
    { key: '66_plus', label: '66+', color: '#ffffff' }
  ];
  const characterPalette = ['var(--accent)', '#ffd5e4', '#66d399', '#9b7df0', '#ffcf5c'];

  function bucketAge(age) {
    if (age == null || Number.isNaN(age)) return null;
    if (age <= 17) return '10_17';
    if (age <= 25) return '18_25';
    if (age <= 35) return '26_35';
    if (age <= 45) return '36_45';
    if (age <= 55) return '46_55';
    if (age <= 65) return '56_65';
    return '66_plus';
  }

  function normalizeGenderKey(value) {
    if (!value) return '';
    const v = `${value}`.trim().toLowerCase();
    if (['hombre', 'man', 'masculino'].includes(v)) return 'man';
    if (['mujer', 'woman', 'femenino'].includes(v)) return 'woman';
    if (v.includes('no bin')) return 'nonbinary';
    if (v.includes('prefiero') || v.includes('no decir')) return 'prefiero_no_decir';
    if (v.includes('no responde')) return 'no_responde';
    if (v.includes('otro')) return 'otro';
    return v.replace(/\s+/g, '_');
  }

  function localizeGenderLabel(key) {
    const norm = normalizeGenderKey(key);
    const labels = genderLabelMap[currentLang] || genderLabelMap.es;
    return labels[norm] || key || '';
  }

  function prettifyCharacterLabel(value) {
    if (!value) return '';
    return `${value}`
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function clampNumericFields(container) {
    container.querySelectorAll('input[type="number"], input[data-numeric="true"]').forEach(input => {
      const readNum = (el, attr) => {
        const val = el.getAttribute(attr);
        if (val == null || val === '') return null;
        const num = parseInt(val, 10);
        return Number.isNaN(num) ? null : num;
      };
      const min = readNum(input, 'min') ?? readNum(input, 'data-min');
      const max = readNum(input, 'max') ?? readNum(input, 'data-max');
      const maxDigitsAttr = input.getAttribute('maxlength');
      const maxDigits = maxDigitsAttr ? parseInt(maxDigitsAttr, 10) : (max ? String(max).length : null);
      if (maxDigits != null && !maxDigitsAttr) {
        input.setAttribute('maxlength', `${maxDigits}`);
      }
      input.addEventListener('input', () => {
        let digits = input.value.replace(/\D/g, '');
        if (maxDigits != null) {
          digits = digits.slice(0, maxDigits);
        }
        if (!digits) {
          input.value = '';
          return;
        }
        let num = parseInt(digits, 10);
        if (!Number.isNaN(num)) {
          if (min !== null && num < min) num = min;
          if (max !== null && num > max) num = max;
          input.value = num;
        } else {
          input.value = '';
        }
      });
    });

    const cpField = container.querySelector('#codigo_postal');
    if (cpField) {
      cpField.setAttribute('inputmode', 'numeric');
      cpField.setAttribute('pattern', '[0-9]*');
      cpField.addEventListener('input', () => {
        const digits = (cpField.value || '').replace(/\D/g, '').slice(0, 5);
      cpField.value = digits;
    });

    const ageField = container.querySelector('#edad');
    if (ageField) {
      const maxDigits = 3;
      ageField.setAttribute('maxlength', `${maxDigits}`);
      ageField.addEventListener('input', () => {
        let digits = ageField.value.replace(/\D/g, '').slice(0, maxDigits);
        if (!digits) {
          ageField.value = '';
          return;
        }
        let num = parseInt(digits, 10);
        const min = ageField.min ? parseInt(ageField.min, 10) : null;
        const max = ageField.max ? parseInt(ageField.max, 10) : null;
        if (min !== null && num < min) num = min;
        if (max !== null && num > max) num = max;
        ageField.value = num;
      });
    }
  }
  }

  function setProgress(i) {
    if (!TOTAL_STEPS) {
      stepText.textContent = languagePrompt;
      bar.style.width = '0%';
      return;
    }
    if (i < TOTAL_STEPS) {
      stepText.textContent = locale.stepLabel(i + 1, TOTAL_STEPS);
      bar.style.width = (i / TOTAL_STEPS * 100) + '%';
    } else {
      stepText.textContent = locale.completed;
      bar.style.width = '100%';
    }
  }

  function showOnly(el) {
    stepsEls.forEach(node => node.classList.remove('active'));
    el.classList.add('active');
  }

  function goToDone() {
    setProgress(TOTAL_STEPS);
    showOnly(doneView);
    loadMiniStats();
  }

  function requiredMessage() {
    statusEl.textContent = locale.statusRequired;
    setTimeout(() => {
      if (statusEl.textContent === locale.statusRequired) statusEl.textContent = '';
    }, 1500);
  }

  function matchesCondition(value, expected) {
    const expectedArr = Array.isArray(expected) ? expected : [expected];
    if (Array.isArray(value)) {
      return value.some(v => expectedArr.includes(v));
    }
    return expectedArr.includes(value);
  }

  function applyLocale(lang) {
    locale = I18N[lang] || I18N.es;
    const h1 = document.querySelector('h1');
    if (h1) {
      const localizedTitle = (cfg.title && cfg.title[lang]) || (cfg.title && cfg.title.es) || locale.defaultTitle;
      h1.textContent = localizedTitle;
    }
    if (doneTitle) doneTitle.textContent = locale.doneTitle;
    if (doneSub) doneSub.textContent = locale.doneSub;
    again.textContent = locale.again;
    if (statsMeta) statsMeta.textContent = locale.statsMeta;
  }

  function renderLanguageSelector() {
    currentLang = null;
    locale = I18N.es;
    activeSteps = [];
    answers = {};
    stepIndex = 0;
    TOTAL_STEPS = 0;
    prevSteps.length = 0;
    stepIndexById.clear();
    statusEl.textContent = '';
    setProgress(0);
    const languages = (cfg && Array.isArray(cfg.languages) && cfg.languages.length)
      ? cfg.languages
      : [{ code: 'es', label: 'Castellano' }];
    const heading = `${I18N.eu.selectLanguageTitle} · ${I18N.es.selectLanguageTitle} · ${I18N.en.selectLanguageTitle}`;
    const sub = `${I18N.eu.selectLanguageSubtitle}<br>${I18N.es.selectLanguageSubtitle}<br>${I18N.en.selectLanguageSubtitle}`;
    const buttons = languages.map(l => `<button class="btn primary" type="button" data-lang="${l.code}">${l.label}</button>`).join('');
    stepHost.innerHTML = `
      <div class="lang-select">
        <p class="lbl">${heading}</p>
        <p class="sub">${sub}</p>
        <div class="lang-buttons">${buttons}</div>
      </div>
    `;
    showOnly(stepHost);
    stepHost.querySelectorAll('[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => startSurvey(btn.dataset.lang));
    });
  }

  function startSurvey(lang) {
    currentLang = lang;
    applyLocale(lang);
    activeSteps = (stepsByLang[lang] || []).slice();
    TOTAL_STEPS = activeSteps.length;
    if (!TOTAL_STEPS) {
      const unavailable = 'Idioma no disponible / Hizkuntza ez dago eskuragarri / Language not available';
      stepHost.innerHTML = `<p class="sub">${unavailable}</p>`;
      showOnly(stepHost);
      bar.style.width = '0%';
      stepText.textContent = unavailable;
      return;
    }
    answers = { __lang: lang };
    Object.keys(questionLabels).forEach(k => delete questionLabels[k]);
    prevSteps.length = 0;
    stepIndexById.clear();
    activeSteps.forEach((step, idx) => stepIndexById.set(step.id, idx));
    stepIndex = 0;
    statusEl.textContent = '';
    renderStep(activeSteps[0]);
  }

  function fillOptionLabels() {
    const mapLabel = (opts, val) => {
      const opt = (opts || []).find(o => `${o.value}` === `${val}`);
      return opt ? opt.label : val;
    };
    activeSteps.forEach(step => {
      const { id, type, options = [], fields = [] } = step;
      if ((type === 'chips' || type === 'rating' || type === 'select') && answers[id] != null && answers[`${id}_labels`] == null) {
        if (Array.isArray(answers[id])) {
          answers[`${id}_labels`] = answers[id].map(v => mapLabel(options, v));
        } else {
          answers[`${id}_labels`] = mapLabel(options, answers[id]);
        }
      }
      if (type === 'form') {
        fields.forEach(f => {
          if (f.type === 'select' && answers[f.id] != null && answers[`${f.id}_labels`] == null) {
            answers[`${f.id}_labels`] = mapLabel(f.options || [], answers[f.id]);
          }
        });
      }
    });
  }

  function renderStep(step) {
    if (!step) return;
    const {
      id,
      type,
      label,
      placeholder,
      options = [],
      hint,
      required,
      maxLength,
      min = 1,
      max = 5,
      fields = [],
      comment_field: commentField = null,
      multi = false,
      section_title: sectionTitle = null,
      jump_if: jumpIf = null
    } = step;
    if (label) {
      questionLabels[id] = label;
    }
    if (commentField && commentField.label) {
      questionLabels[commentField.id] = commentField.label;
    }

    const renderExtraField = field => {
      if (!field) return '';
      if (field.type === 'textarea') {
        return `
          <div class="field">
            <label class="lbl" for="${field.id}">${field.label || ''}</label>
            <textarea id="${field.id}" rows="${field.rows || 3}" ${field.placeholder ? `placeholder="${field.placeholder}"` : ''} ${field.maxLength ? `maxlength="${field.maxLength}"` : ''}></textarea>
            ${field.hint ? `<div class="hint">${field.hint}</div>` : ''}
          </div>
        `;
      }
      const isNumber = field.type === 'number';
      const inputType = isNumber ? 'number' : 'text';
      const numberMaxLen = isNumber && field.max ? String(field.max).length : null;
      const attrs = [
        `id="${field.id}"`,
        `type="${inputType}"`,
        isNumber ? 'data-numeric="true"' : '',
        isNumber ? 'inputmode="numeric" pattern="[0-9]*"' : '',
        isNumber ? 'step="1"' : '',
        field.placeholder ? `placeholder="${field.placeholder}"` : '',
        isNumber && numberMaxLen ? `maxlength="${numberMaxLen}"` : (field.maxLength ? `maxlength="${field.maxLength}"` : ''),
        isNumber && field.min ? `min="${field.min}" data-min="${field.min}"` : '',
        isNumber && field.max ? `max="${field.max}" data-max="${field.max}"` : ''
      ].filter(Boolean).join(' ');
      return `
        <div class="field">
          <label class="lbl" for="${field.id}">${field.label || ''}</label>
          <input ${attrs} autocomplete="off" />
          ${field.hint ? `<div class="hint">${field.hint}</div>` : ''}
        </div>
      `;
    };

    const isLast = stepIndex === TOTAL_STEPS - 1;
    const nav = `
      <div class="nav">
        <button class="btn" id="btnBack" type="button">${locale.back}</button>
        <button class="btn primary" id="btnNext" type="button">${isLast ? locale.submit : locale.next}</button>
      </div>
    `;

    const titleBlock = sectionTitle ? `<p class="lbl" style="text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:6px;">${sectionTitle}</p>` : '';

    let body = '';
    if (type === 'text') {
      body = `
        ${titleBlock}
        <label class="lbl" for="${id}">${label || ''}</label>
        <input id="${id}" type="text" ${placeholder ? `placeholder="${placeholder}"` : ''} ${maxLength ? `maxlength="${maxLength}"` : ''} autocomplete="off" />
        ${commentField ? renderExtraField(commentField) : ''}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else if (type === 'textarea') {
      body = `
        ${titleBlock}
        <label class="lbl" for="${id}">${label || ''}</label>
        <textarea id="${id}" rows="3" ${placeholder ? `placeholder="${placeholder}"` : ''} ${maxLength ? `maxlength="${maxLength}"` : ''}></textarea>
        ${commentField ? renderExtraField(commentField) : ''}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else if (type === 'chips') {
      const chips = options.map(o => `<div class="chip" data-value="${o.value}" role="button" aria-pressed="false">${o.label}</div>`).join('');
      body = `
        ${titleBlock}
        <label class="lbl">${label || ''}</label>
        <div class="choices" role="group">${chips}</div>
        ${commentField ? renderExtraField(commentField) : ''}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else if (type === 'select') {
      const opts = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      body = `
        ${titleBlock}
        <label class="lbl" for="${id}">${label || ''}</label>
        <select id="${id}">
          <option value="" disabled selected>—</option>
          ${opts}
        </select>
        ${commentField ? renderExtraField(commentField) : ''}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else if (type === 'rating') {
      let ratingChips = '';
      for (let v = min; v <= max; v++) {
        ratingChips += `<div class="chip" data-value="${v}" role="button" aria-pressed="false">${v}</div>`;
      }
      body = `
        ${titleBlock}
        <label class="lbl">${label || ''}</label>
        <div class="choices" role="group">${ratingChips}</div>
        ${commentField ? renderExtraField(commentField) : ''}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else if (type === 'form') {
      const fieldMarkup = fields.map(field => {
        if (field.type === 'select') {
          const opts = (field.options || []).map(o => `<option value="${o.value}">${o.label}</option>`).join('');
          return `
            <div class="field">
              <label class="lbl" for="${field.id}">${field.label || ''}</label>
              <select id="${field.id}">
                <option value="" disabled selected>—</option>
                ${opts}
              </select>
              ${field.hint ? `<div class="hint">${field.hint}</div>` : ''}
            </div>
          `;
        }
        return renderExtraField(field);
      }).join('');
      body = `
        ${titleBlock}
        ${label ? `<p class="lbl" style="margin-bottom:14px">${label}</p>` : ''}
        ${fieldMarkup}
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        ${nav}
      `;
    } else {
      body = `
        <p class="sub">Tipo de pregunta no soportado: <code>${type}</code></p>
        ${nav}
      `;
    }

    stepHost.innerHTML = body;
    setProgress(stepIndex);
    showOnly(stepHost);
    clampNumericFields(stepHost);

    const btnBack = document.getElementById('btnBack');
    const btnNext = document.getElementById('btnNext');

    btnBack.disabled = (prevSteps.length === 0);
    btnBack.addEventListener('click', () => {
      if (prevSteps.length === 0) return;
      stepIndex = prevSteps.pop();
      renderStep(activeSteps[stepIndex]);
    });

    if (type === 'chips' || type === 'rating') {
      const container = stepHost.querySelector('.choices');
      const optionLabel = val => {
        const opt = options.find(o => `${o.value}` === `${val}`);
        return opt ? opt.label : val;
      };
      if (type === 'chips' && multi) {
        const current = Array.isArray(answers[id]) ? new Set(answers[id]) : new Set();
        if (current.size) {
          container.querySelectorAll('.chip').forEach(x => {
            if (current.has(x.dataset.value)) x.setAttribute('aria-pressed', 'true');
          });
        }
        const toggleChip = chip => {
          if (!chip) return;
          const val = chip.dataset.value;
          const active = chip.getAttribute('aria-pressed') === 'true';
          if (active) {
            chip.setAttribute('aria-pressed', 'false');
            current.delete(val);
          } else {
            chip.setAttribute('aria-pressed', 'true');
            current.add(val);
          }
          const vals = Array.from(current);
          answers[id] = vals;
          answers[`${id}_labels`] = vals.map(optionLabel);
        };
        container.addEventListener('click', e => toggleChip(e.target.closest('.chip')));
      } else {
        const current = answers[id] ?? null;
        if (current) {
          container.querySelectorAll('.chip').forEach(x => {
            if (x.dataset.value == current) x.setAttribute('aria-pressed', 'true');
          });
        }
        const selectChip = chip => {
          if (!chip) return;
          container.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', 'false'));
          chip.setAttribute('aria-pressed', 'true');
          answers[id] = chip.dataset.value;
          answers[`${id}_labels`] = optionLabel(chip.dataset.value);
        };
        container.addEventListener('click', e => selectChip(e.target.closest('.chip')));
        container.addEventListener('pointerup', e => selectChip(e.target.closest('.chip')));
      }
    }

    if (type === 'text' || type === 'textarea') {
      const input = document.getElementById(id);
      if (answers[id]) input.value = answers[id];
      input.addEventListener('input', () => {
        answers[id] = input.value.trim();
      });
    }

    if (type === 'select') {
      const sel = document.getElementById(id);
      sel.addEventListener('change', () => {
        answers[id] = sel.value;
        const opt = Array.from(sel.options).find(o => o.value === sel.value);
        if (opt) answers[`${id}_labels`] = opt.textContent;
      });
      if (answers[id]) sel.value = answers[id];
    }

    if (type === 'form') {
      fields.forEach(field => {
        if (field.type === 'select') {
          const sel = document.getElementById(field.id);
          sel.addEventListener('change', () => {
            answers[field.id] = sel.value;
            const opt = Array.from(sel.options).find(o => o.value === sel.value);
            if (opt) answers[`${field.id}_labels`] = opt.textContent;
          });
          if (answers[field.id]) sel.value = answers[field.id];
        } else {
          const input = document.getElementById(field.id);
          if (answers[field.id]) input.value = answers[field.id];
          input.addEventListener('input', () => {
            answers[field.id] = input.value.trim();
          });
        }
      });
    }

    if (commentField) {
      const extra = document.getElementById(commentField.id);
      if (extra) {
        if (answers[commentField.id]) extra.value = answers[commentField.id];
        const handler = () => { answers[commentField.id] = extra.value.trim(); };
        extra.addEventListener('input', handler);
        extra.addEventListener('change', handler);
      }
    }

    btnNext.addEventListener('click', async () => {
      if (step.required && type !== 'form') {
        const val = answers[id];
        if (
          val == null ||
          (typeof val === 'string' && val.trim().length === 0) ||
          (Array.isArray(val) && val.length === 0)
        ) {
          requiredMessage();
          return;
        }
      }
      if (type === 'form') {
        const missingField = fields.find(field => field.required && (!answers[field.id] || `${answers[field.id]}`.trim().length === 0));
        if (missingField) {
          requiredMessage();
          return;
        }
      }
      if (commentField && commentField.required) {
        const val = answers[commentField.id];
        if (val == null || `${val}`.trim().length === 0) {
          requiredMessage();
          return;
        }
      }

      if (stepIndex === TOTAL_STEPS - 1) {
        btnNext.disabled = true;
        statusEl.textContent = locale.statusSending;
        const rawAssoc = Array.isArray(answers.asociaciones_alava) ? answers.asociaciones_alava.slice() : null;
        fillOptionLabels();
        if (rawAssoc) {
          answers.asociaciones_alava_values = rawAssoc;
        }
        if (Array.isArray(answers.asociaciones_alava_labels) && answers.asociaciones_alava_labels.length) {
          answers.asociaciones_alava = answers.asociaciones_alava_labels.slice();
        }
        answers.__lang = currentLang;
        answers.__labels = { ...questionLabels };
        try {
          await postResponse(surveyId, answers);
          statusEl.textContent = '';
          goToDone();
        } catch (e) {
          statusEl.textContent = locale.statusError;
          btnNext.disabled = false;
        }
      } else {
        let nextIndex = stepIndex + 1;
        if (jumpIf && answers[id] != null && jumpIf.target) {
          const targetIdx = stepIndexById.get(jumpIf.target);
          if (typeof targetIdx === 'number' && matchesCondition(answers[id], jumpIf.value)) {
            nextIndex = targetIdx;
          }
        }
        if (nextIndex >= TOTAL_STEPS) {
          goToDone();
        } else {
          prevSteps.push(stepIndex);
          stepIndex = nextIndex;
          renderStep(activeSteps[stepIndex]);
        }
      }
    });

    stepHost.querySelectorAll('input,textarea,select').forEach(el => {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnNext.click();
        }
      });
    });
  }

  async function postResponse(surveyId, payload) {
    const res = await fetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: surveyId, payload })
    });
    if (!res.ok) throw new Error('Server error');
    return res.json();
  }

  function buildSummary(rows) {
    const ageCounts = {};
    const genderCounts = {};
    const characterCounts = {};
    const ratings = [];
    (rows || []).forEach(row => {
      const payload = row.payload || {};
      const age = Number(payload.edad);
      const ageBucket = bucketAge(age);
      if (ageBucket) ageCounts[ageBucket] = (ageCounts[ageBucket] || 0) + 1;

      const genderRaw = payload.genero_labels ?? payload.genero;
      const gender = Array.isArray(genderRaw) ? genderRaw[0] : genderRaw;
      if (gender) genderCounts[gender] = (genderCounts[gender] || 0) + 1;

      const rating = Number(payload.valoracion_exposicion);
      if (!Number.isNaN(rating)) ratings.push(rating);

      const characterRaw = payload.personaje_importante_labels ?? payload.personaje_importante;
      const character = Array.isArray(characterRaw) ? characterRaw[0] : characterRaw;
      if (character) characterCounts[character] = (characterCounts[character] || 0) + 1;
    });

    const ageSegments = ageBuckets
      .map(b => ({ label: b.label, value: ageCounts[b.key] || 0, color: b.color }))
      .filter(seg => seg.value > 0);
    const genderSegments = Object.entries(genderCounts)
      .map(([label, value]) => ({
        label: localizeGenderLabel(label),
        value,
        color: genderColors[normalizeGenderKey(label)] || 'var(--accent)'
      }))
      .sort((a, b) => b.value - a.value);
    const characterSegments = Object.entries(characterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value], idx) => ({
        label: prettifyCharacterLabel(label),
        value,
        color: characterPalette[idx % characterPalette.length]
      }));
    const ratingCount = ratings.length;
    const ratingAvg = ratingCount ? ratings.reduce((acc, v) => acc + v, 0) / ratingCount : 0;
    return {
      total: Array.isArray(rows) ? rows.length : 0,
      ageSegments,
      genderSegments,
      characterSegments,
      ratingAvg,
      ratingCount
    };
  }

  function renderDonut(segments) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 108 108');
    svg.classList.add('donut');
    const total = segments.reduce((acc, seg) => acc + (seg.value || 0), 0);
    if (!total) {
      const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      inner.setAttribute('cx', '54');
      inner.setAttribute('cy', '54');
      inner.setAttribute('r', '34');
      inner.setAttribute('fill', 'rgba(0,0,0,0.08)');
      svg.appendChild(inner);
      return { svg, total };
    }
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    segments.forEach(seg => {
      const portion = (seg.value || 0) / total;
      const dash = portion * circumference;
      const gap = Math.max(circumference - dash, 0);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '54');
      circle.setAttribute('cy', '54');
      circle.setAttribute('r', `${radius}`);
      circle.setAttribute('fill', 'none');
      circle.style.stroke = seg.color || 'var(--accent)';
      circle.setAttribute('stroke-width', '12');
      circle.setAttribute('stroke-dasharray', `${dash} ${gap}`);
      circle.setAttribute('stroke-dashoffset', `${-offset}`);
      circle.setAttribute('transform', 'rotate(-90 54 54)');
      svg.appendChild(circle);
      offset += dash;
    });
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', '54');
    inner.setAttribute('cy', '54');
    inner.setAttribute('r', '30');
    inner.setAttribute('fill', 'rgba(0,0,0,0.08)');
    svg.appendChild(inner);
    return { svg, total };
  }

  function renderDonutCard(title, meta, segments) {
    if (!segments || segments.length === 0) return null;
    const { svg, total } = renderDonut(segments);
    if (!total) return null;
    const card = document.createElement('div');
    card.className = 'stat-card';
    const h = document.createElement('h3');
    h.textContent = title;
    const metaEl = document.createElement('p');
    metaEl.className = 'meta';
    metaEl.textContent = meta;
    const legend = document.createElement('div');
    legend.className = 'legend';
    segments
      .filter(seg => !seg.hideLegend)
      .forEach(seg => {
        const row = document.createElement('div');
        row.className = 'legend-row';
        const sw = document.createElement('span');
        sw.className = 'legend-swatch';
        sw.style.background = seg.color || 'var(--accent)';
        const txt = document.createElement('span');
        txt.textContent = `${seg.label}`;
        row.appendChild(sw);
        row.appendChild(txt);
        legend.appendChild(row);
      });
    card.appendChild(h);
    card.appendChild(metaEl);
    card.appendChild(svg);
    card.appendChild(legend);
    return card;
  }

  function renderMiniStats(summary) {
    if (!miniStats) return;
    miniStats.innerHTML = '';
    if (!summary || !summary.total) {
      if (statsMeta) statsMeta.textContent = locale.statsEmpty;
      miniStats.innerHTML = `<p class="hint">${locale.statsEmpty}</p>`;
      return;
    }
    if (statsMeta) statsMeta.textContent = '';
    const cards = [];
    if (summary.ratingCount) {
      const pct = Math.max(0, Math.min(100, (summary.ratingAvg / 10) * 100));
      const ratingSegments = [
        { label: `${summary.ratingAvg.toFixed(1)} / 10`, value: pct, color: 'var(--accent)' },
        { label: 'Resto', value: 100 - pct, color: 'rgba(0,0,0,0.12)', hideLegend: true }
      ];
      const metaRating = locale.statsCount ? locale.statsCount(summary.ratingCount) : `${summary.ratingCount}`;
      cards.push(renderDonutCard(locale.statsRating, metaRating, ratingSegments));
    }
    if (summary.characterSegments && summary.characterSegments.length) {
      const characterTotal = summary.characterSegments.reduce((acc, s) => acc + s.value, 0);
      const metaChar = locale.statsCount ? locale.statsCount(characterTotal) : `${characterTotal}`;
      cards.push(renderDonutCard(locale.statsCharacter, metaChar, summary.characterSegments));
    }
    const ageTotal = summary.ageSegments.reduce((acc, s) => acc + s.value, 0);
    if (ageTotal) {
      const metaAge = locale.statsCount ? locale.statsCount(ageTotal) : `${ageTotal}`;
      cards.push(renderDonutCard(locale.statsAge, metaAge, summary.ageSegments));
    }
    const genderTotal = summary.genderSegments.reduce((acc, s) => acc + s.value, 0);
    if (genderTotal) {
      const metaGender = locale.statsCount ? locale.statsCount(genderTotal) : `${genderTotal}`;
      cards.push(renderDonutCard(locale.statsGender, metaGender, summary.genderSegments));
    }
    if (!cards.length) {
      miniStats.innerHTML = `<p class="hint">${locale.statsEmpty}</p>`;
      return;
    }
    cards.filter(Boolean).forEach(card => miniStats.appendChild(card));
  }

  async function loadMiniStats() {
    if (!miniStats) return;
    if (statsMeta) statsMeta.textContent = locale.statsMeta;
    miniStats.innerHTML = '';
    try {
      const res = await fetch('/api/responses?status=approved', { cache: 'no-store' });
      if (!res.ok) throw new Error('Server error');
      const rows = await res.json();
      const summary = buildSummary(rows);
      renderMiniStats(summary);
    } catch (err) {
      console.error('miniStats error', err);
      if (statsMeta) statsMeta.textContent = locale.statsError;
      miniStats.innerHTML = `<p class="hint">${locale.statsError}</p>`;
    }
  }

  again.addEventListener('click', () => {
    renderLanguageSelector();
  });

  (async function init() {
    const r = await fetch('/static/questions.json', { cache: 'no-store' });
    cfg = await r.json();
    surveyId = cfg.survey_id || 1;
    stepsByLang = cfg.steps || {};
    renderLanguageSelector();
  })();
});
