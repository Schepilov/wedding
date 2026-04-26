/* ----------------------------------------------------------
   0. Подстановка текстов из config.js в [data-text="..."]
   ---------------------------------------------------------- */

(function () {
  'use strict';

  var cfg = window.WEDDING_CONFIG;
  if (!cfg) return;

  function bindTexts() {
    document.querySelectorAll('[data-text]').forEach(function (el) {
      var path  = el.getAttribute('data-text');
      var value = path.split('.').reduce(function (obj, key) {
        return obj == null ? undefined : obj[key];
      }, cfg);
      if (typeof value === 'string') el.textContent = value;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTexts);
  } else {
    bindTexts();
  }
})();

/* ----------------------------------------------------------
   1. API для связи с Google Sheets
   ---------------------------------------------------------- */


(function () {
  'use strict';

  var API_BASE = 'https://script.google.com/macros/s/AKfycbxXe2jl4dQ5c4frqIFlG1OJ58VuZv63onj_-1X_q07-Me67cevuPqd8UVIwcHll487r4Q/exec';

  window.WEDDING_API = {
    baseUrl: API_BASE,
    inviteData: null,
    responseData: null,
    token: null,
  };

    window.__inviteReadyResolve = null;
    window.__inviteReadyPromise = new Promise(function (resolve) {
      window.__inviteReadyResolve = resolve;
  });

  function getTokenFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return (params.get('i') || '').trim();
  }

  function hideEverythingExceptHero() {
    document.querySelectorAll('main.page > *').forEach(function (el) {
      if (!el.classList.contains('hero')) {
        el.hidden = true;
      }
    });

    document.querySelectorAll('.schedule__sep').forEach(function (el) {
      el.hidden = true;
    });
  }

  function showMainContent() {
    document.querySelectorAll('main.page > *').forEach(function (el) {
      el.hidden = false;
    });

    document.querySelectorAll('.schedule__sep').forEach(function (el) {
      el.hidden = false;
    });
  }

  function applyInviteVisibility(invite) {
    var day1 = document.querySelector('.js-day1');
    var dinner = document.querySelector('.js-dinner');
    var day2 = document.querySelector('.js-day2');
    var chat = document.getElementById('chat');

    if (day1) day1.hidden = !invite.showDay1;
    if (dinner) dinner.hidden = !invite.showDinner;
    if (day2) day2.hidden = !invite.showDay2;
    if (chat) chat.hidden = !invite.showChat;

    var sepZags = document.querySelector('.js-sep-zags');
    var sepParty = document.querySelector('.js-sep-party');

    if (sepZags) {
      sepZags.hidden = !(invite.showDay1 && invite.showDinner);
    }

    if (sepParty) {
      var beforePartyVisible = invite.showDay1 || invite.showDinner;
      sepParty.hidden = !(beforePartyVisible && invite.showDay2);
    }
  }

  async function loadInvite() {
    var token = getTokenFromUrl();
    window.WEDDING_API.token = token;

    if (!token) {
      hideEverythingExceptHero();
      if (typeof window.__inviteReadyResolve === 'function') {
        window.__inviteReadyResolve();
      }
      return;
    }

    try {
      var url = API_BASE + '?action=invite&token=' + encodeURIComponent(token);
      var res = await fetch(url, { method: 'GET' });
      var data = await res.json();

      if (!data || !data.ok) {
        console.error('[WEDDING API] Ошибка ответа API:', data);
        hideEverythingExceptHero();
        return;
      }

      window.WEDDING_API.inviteData = data.invite || null;
      window.WEDDING_API.responseData = data.response || null;

      showMainContent();
      applyInviteVisibility(window.WEDDING_API.inviteData);

      if (typeof window.initRsvpForm === 'function') {
        window.initRsvpForm();
      }

      if (typeof window.__inviteReadyResolve === 'function') {
        window.__inviteReadyResolve();
      }


    } catch (err) {
      console.error('[WEDDING API] Ошибка загрузки приглашения:', err);
      hideEverythingExceptHero();
      if (typeof window.__inviteReadyResolve === 'function') {
        window.__inviteReadyResolve();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInvite);
  } else {
    loadInvite();
  }
})();


/* ----------------------------------------------------------
   2. Анкета гостей (RSVP) — формируется из window.RSVP_CONFIG
   ---------------------------------------------------------- */

window.initRsvpForm = function () {
  'use strict';

  var cfg = window.RSVP_CONFIG || {};
  var api = window.WEDDING_API || {};
  var invite = api.inviteData || null;

  if (!invite) return;

  cfg.guests = Array.isArray(invite.guests) ? invite.guests : [];
  cfg.plusOneAllowed = !!invite.plusOneAllowed;
  cfg.plusOneEvents = Array.isArray(invite.plusOneEvents) ? invite.plusOneEvents : [];

  var EVENTS = {
    day1:   'на росписи (16 июля)',
    dinner: 'на семейном ужине (16 июля)',
    day2:   'на вечеринке (19 июля)',
  };

  var ATTENDANCE = [
    { val: 'yes', label: 'будет'    },
    { val: 'no',  label: 'не будет' },
  ];

  var DRINKS = [
    { val: 'soft',       label: 'безалкогольные' },
    { val: 'white_wine', label: 'белое вино'      },
    { val: 'red_wine',   label: 'красное вино'    },
    { val: 'sparkling',  label: 'игристое'        },
    { val: 'beer',       label: 'пиво'            },
  ];

  var ALLERGENS = [
    'орехи', 'морепродукты', 'яйца', 'соя',
    'цитрусовые', 'клубника', 'мёд', 'шоколад',
    'рыба', 'морковь', 'сельдерей',
  ];

  var INTOLERANCES = [
    'лактоза', 'глютен', 'фруктоза',
    'гистамин', 'сорбит', 'казеин',
  ];

  var HOT = [
    { val: 'meat', label: 'мясо', hint: 'говяжьи щёчки с луком‑пореем и кремом пармезан' },
    { val: 'fish', label: 'рыба', hint: 'лосось со спаржей и цветной капустой'            },
  ];

  var plusOneCounter = 0;

  function mk(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function uid(guestId, suffix) {
    return 'rsvp-' + guestId + '-' + suffix;
  }

  function makePills(name, items) {
    var wrap = mk('div', 'pill-group');
    items.forEach(function (item) {
      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = name;
      inp.id = name + '-' + item.val; inp.value = item.val;
      inp.className = 'sr-only';
      inp.addEventListener('change', function () { window._haptics?.trigger([18]); });

      var lbl = document.createElement('label');
      lbl.htmlFor = inp.id; lbl.className = 'pill';
      lbl.textContent = item.label;

      wrap.appendChild(inp);
      wrap.appendChild(lbl);
    });
    return wrap;
  }

  function makeCheckPills(namePrefix, items) {
    var wrap = mk('div', 'pill-group pill-group_wrap');
    items.forEach(function (item) {
      var label = item.label || item;
      var val   = item.val   || label.toLowerCase().replace(/[^a-z0-9а-яёa-z]/gi, '_');
      var id    = namePrefix + '-' + val;

      var inp = document.createElement('input');
      inp.type = 'checkbox'; inp.name = namePrefix + '[]';
      inp.id = id; inp.value = val; inp.className = 'sr-only';
      inp.addEventListener('change', function () { window._haptics?.trigger([18]); });

      var lbl = document.createElement('label');
      lbl.htmlFor = id; lbl.className = 'pill';
      lbl.textContent = label;

      wrap.appendChild(inp);
      wrap.appendChild(lbl);
    });
    return wrap;
  }

  function buildDrinksSection(gid) {
    var wrap = mk('div', 'rsvp-field');
    var ttl  = mk('p', 'rsvp-field__label');
    ttl.textContent = 'Напитки';
    wrap.appendChild(ttl);

    var pills = makeCheckPills(uid(gid, 'drinks'), DRINKS);
    wrap.appendChild(pills);

    return wrap;
  }

  function buildHotSection(gid) {
    var wrap = mk('div', 'rsvp-field');
    var ttl  = mk('p', 'rsvp-field__label');
    ttl.textContent = 'Горячее';
    wrap.appendChild(ttl);

    var list = mk('div', 'hot-list');
    HOT.forEach(function (item) {
      var id = uid(gid, 'hot') + '-' + item.val;

      var inp = document.createElement('input');
      inp.type = 'radio'; inp.name = uid(gid, 'hot');
      inp.id = id; inp.value = item.val; inp.className = 'sr-only';
      inp.addEventListener('change', function () { window._haptics?.trigger([18]); });

      var lbl = mk('label', 'hot-option');
      lbl.htmlFor = id;

      var nameSpan = mk('span', 'hot-option__name');
      nameSpan.textContent = item.label;
      var hintSpan = mk('span', 'hot-option__hint');
      hintSpan.textContent = item.hint;

      lbl.appendChild(nameSpan);
      lbl.appendChild(hintSpan);

      var itemWrap = mk('div', 'hot-item');
      itemWrap.appendChild(inp);
      itemWrap.appendChild(lbl);
      list.appendChild(itemWrap);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildMulticheck(namePrefix, items, placeholder) {
    var wrap = mk('div', 'multicheck');
    wrap.appendChild(makeCheckPills(namePrefix, items));
    var inp = document.createElement('input');
    inp.type = 'text'; inp.name = namePrefix + '_custom';
    inp.placeholder = placeholder; inp.className = 'rsvp-input';
    wrap.appendChild(inp);
    return wrap;
  }

  function buildAllergySection(gid) {
    var wrap = mk('div', 'rsvp-field');
    var ttl  = mk('p', 'rsvp-field__label');
    ttl.textContent = 'Аллергии и непереносимости';
    wrap.appendChild(ttl);

    var yesNo = makePills(uid(gid, 'allergy'), [
      { val: 'no',  label: 'нет'  },
      { val: 'yes', label: 'есть' },
    ]);
    wrap.appendChild(yesNo);

    var reveal = mk('div', 'rsvp-reveal');
    reveal.hidden = true;

    var sub1 = mk('p', 'rsvp-field__sublabel');
    sub1.textContent = 'Аллергии';
    reveal.appendChild(sub1);
    reveal.appendChild(buildMulticheck(uid(gid, 'allergens'), ALLERGENS, 'другие аллергии…'));

    var sub2 = mk('p', 'rsvp-field__sublabel');
    sub2.textContent = 'Непереносимости';
    reveal.appendChild(sub2);
    reveal.appendChild(buildMulticheck(uid(gid, 'intolerances'), INTOLERANCES, 'другие непереносимости…'));

    wrap.appendChild(reveal);

    yesNo.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        reveal.hidden = (this.value !== 'yes');
      });
    });

    return wrap;
  }

  function buildPartySection(gid) {
    var wrap = mk('div', 'party-section');
    wrap.appendChild(buildDrinksSection(gid));
    wrap.appendChild(buildHotSection(gid));
    wrap.appendChild(buildAllergySection(gid));
    return wrap;
  }

  function buildEventsSection(gid, events) {
    var wrap = mk('div', 'rsvp-events');
    events.forEach(function (evKey) {
      var evWrap = mk('div', 'rsvp-event');
      var lbl = mk('p', 'rsvp-field__label');
      lbl.textContent = EVENTS[evKey] || evKey;
      evWrap.appendChild(lbl);
      evWrap.appendChild(makePills(uid(gid, 'att-' + evKey), ATTENDANCE));
      wrap.appendChild(evWrap);
    });
    return wrap;
  }

  function buildGuestCard(gid, name, events, isNew) {
    var card = mk('div', 'guest-card');
    card.dataset.guestId = gid;

    var header = mk('div', 'guest-card__header');
    if (isNew) {
      var nameInp = document.createElement('input');
      nameInp.type = 'text'; nameInp.name = uid(gid, 'name');
      nameInp.placeholder = 'имя и фамилия гостя';
      nameInp.className = 'rsvp-input guest-card__name-input';
      header.appendChild(nameInp);

      var removeBtn = mk('button', 'guest-card__remove');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'удалить гостя');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () { card.remove(); });
      header.appendChild(removeBtn);
    } else {
      var nameEl = mk('p', 'guest-card__name');
      nameEl.textContent = name;
      header.appendChild(nameEl);
    }
    card.appendChild(header);

    card.appendChild(buildEventsSection(gid, events));

    if (events.indexOf('day2') !== -1) {
      var partyWrap = mk('div', 'party-section-wrap');
      partyWrap.hidden = true;
      partyWrap.appendChild(buildPartySection(gid));
      card.appendChild(partyWrap);

      card.querySelectorAll('[name="' + uid(gid, 'att-day2') + '"]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          partyWrap.hidden = (this.value !== 'yes');
        });
      });
    }

    return card;
  }

  function ensurePlusOneCard(savedGuest) {
    if (!savedGuest || !savedGuest.isPlusOne) return null;

    var existing = document.querySelector('.guest-card[data-guest-id="' + savedGuest.guestId + '"]');
    if (existing) return existing;

    var list = document.getElementById('rsvp-guest-list');
    var addBtn = document.getElementById('rsvp-add-btn');
    if (!list) return null;

    var events = Object.keys(savedGuest.attendance || {}).filter(function (key) {
      return ['day1', 'dinner', 'day2'].indexOf(key) !== -1;
    });

    if (!events.length) {
      events = cfg.plusOneEvents || ['day2'];
    }

    var card = buildGuestCard(savedGuest.guestId, '', events, true);

    var nameInp = card.querySelector('.guest-card__name-input');
    if (nameInp) {
      nameInp.value = savedGuest.name || '';
    }

    var removeBtn = card.querySelector('.guest-card__remove');
    if (removeBtn && addBtn) {
      removeBtn.addEventListener('click', function () {
        addBtn.style.display = '';
      });
    }

    list.appendChild(card);

    if (addBtn) {
      addBtn.style.display = 'none';
    }

    return card;
  }

  /* ---- Валидация ---- */

  function showError(afterEl, msg) {
    var err = mk('p', 'rsvp-error');
    err.textContent = msg;
    afterEl.insertAdjacentElement('afterend', err);

    // Автосброс ошибки при следующем взаимодействии с полем
    var container = afterEl.closest('.rsvp-event, .rsvp-field, .guest-card__header');
    if (container) {
      container.querySelectorAll('input').forEach(function (inp) {
        var evType = inp.type === 'text' ? 'input' : 'change';
        inp.addEventListener(evType, function () {
          if (err.parentNode) err.remove();
        }, { once: true });
      });
    }
  }

  function validateCard(card) {
    var ok = true;

    // Имя для +1
    var nameInp = card.querySelector('.guest-card__name-input');
    if (nameInp && !nameInp.value.trim()) {
      showError(nameInp, 'пожалуйста, укажите имя гостя');
      ok = false;
    }

    // Присутствие на каждом мероприятии
    card.querySelectorAll('.rsvp-event').forEach(function (evWrap) {
      var group = evWrap.querySelector('.pill-group');
      if (group && !group.querySelector('input:checked')) {
        showError(group, 'пожалуйста, выберите ответ');
        ok = false;
      }
    });

    // Блок вечеринки — только если открыт
    var partyWrap = card.querySelector('.party-section-wrap');
    if (partyWrap && !partyWrap.hidden) {
      // Напитки: хотя бы один чекбокс
      var drinksGroup = partyWrap.querySelector('.pill-group_wrap');
      if (drinksGroup && !drinksGroup.querySelector('input:checked')) {
        showError(drinksGroup, 'выберите хотя бы один напиток');
        ok = false;
      }

      // Горячее: радио
      var hotList = partyWrap.querySelector('.hot-list');
      if (hotList && !hotList.querySelector('input:checked')) {
        showError(hotList, 'пожалуйста, выберите горячее блюдо');
        ok = false;
      }

      // Аллергия: да/нет радио
      var allergyField = partyWrap.querySelector('.rsvp-field:last-child');
      if (allergyField) {
        var allergyGroup = allergyField.querySelector('.pill-group:not(.pill-group_wrap)');
        if (allergyGroup && !allergyGroup.querySelector('input:checked')) {
          showError(allergyGroup, 'укажите наличие аллергии или непереносимости');
          ok = false;
        }
      }
    }

    return ok;
  }

  function prefillFormFromResponse() {
    var response = window.WEDDING_API && window.WEDDING_API.responseData;
    if (!response || !response.exists || !response.data || !Array.isArray(response.data.guests)) {
      return;
    }

    response.data.guests.forEach(function (savedGuest) {
      if (!savedGuest || !savedGuest.guestId) return;

      var card = document.querySelector('.guest-card[data-guest-id="' + savedGuest.guestId + '"]');

      if (!card && savedGuest.isPlusOne) {
        card = ensurePlusOneCard(savedGuest);
      }

      if (!card) return;

      if (savedGuest.isPlusOne) {
        var plusOneNameInput = card.querySelector('.guest-card__name-input');
        if (plusOneNameInput) {
          plusOneNameInput.value = savedGuest.name || '';
        }
      }

      if (savedGuest.attendance) {
        Object.keys(savedGuest.attendance).forEach(function (eventKey) {
          var value = savedGuest.attendance[eventKey];
          if (!value) return;

          var input = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-att-' + eventKey + '"][value="' + value + '"]');
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      if (savedGuest.party) {
        if (savedGuest.party.hot) {
          var hotInput = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-hot"][value="' + savedGuest.party.hot + '"]');
          if (hotInput) {
            hotInput.checked = true;
            hotInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        if (savedGuest.party.allergy) {
          (savedGuest.party.drinks || []).forEach(function (val) {
          var input = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-drinks[]"][value="' + val + '"]');
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
          var allergyInput = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-allergy"][value="' + savedGuest.party.allergy + '"]');
          if (allergyInput) {
            allergyInput.checked = true;
            allergyInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        (savedGuest.party.allergens || []).forEach(function (val) {
          var input = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-allergens[]"][value="' + val + '"]');
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        var allergensCustom = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-allergens_custom"]');
        if (allergensCustom) {
          allergensCustom.value = savedGuest.party.allergensCustom || '';
        }

        (savedGuest.party.intolerances || []).forEach(function (val) {
          var input = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-intolerances[]"][value="' + val + '"]');
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });

        var intolerancesCustom = card.querySelector('input[name="rsvp-' + savedGuest.guestId + '-intolerances_custom"]');
        if (intolerancesCustom) {
          intolerancesCustom.value = savedGuest.party.intolerancesCustom || '';
        }
      }
    });
  }


  /* ---- Init ---- */

  function init() {
    var list   = document.getElementById('rsvp-guest-list');
    var addBtn = document.getElementById('rsvp-add-btn');
    if (!list) return;

    (cfg.guests || []).forEach(function (g) {
      list.appendChild(buildGuestCard(g.id, g.name, g.events, false));
    });

    prefillFormFromResponse();

    if (cfg.plusOneAllowed && addBtn) {
      addBtn.addEventListener('click', function () {
        window._haptics?.trigger([20]);
        plusOneCounter++;
        var gid    = 'plus' + plusOneCounter;
        var events = cfg.plusOneEvents || ['day2'];
        var card   = buildGuestCard(gid, '', events, true);

        // При удалении карточки возвращаем кнопку
        var removeBtn = card.querySelector('.guest-card__remove');
        if (removeBtn) {
          removeBtn.addEventListener('click', function () {
            addBtn.style.display = '';
          });
        }

        list.appendChild(card);
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        addBtn.style.display = 'none';
      });
    } else if (addBtn) {
      addBtn.style.display = 'none';
    }

    // Валидация при отправке
    var form = document.getElementById('rsvp-form');
    if (form) {

      var submitBtn = form.querySelector('button[type="submit"], .btn[type="submit"], input[type="submit"]');
      var isSubmitting = false;
      var submitBtnDefaultText = submitBtn ? submitBtn.textContent : '';

            function setSubmittingState(state) {
        isSubmitting = state;

        if (!submitBtn) return;

        submitBtn.disabled = state;
        submitBtn.setAttribute('aria-busy', state ? 'true' : 'false');

        if (state) {
          submitBtn.textContent = 'Отправляем…';
          submitBtn.classList.add('is-loading');
        } else {
          submitBtn.textContent = submitBtnDefaultText;
          submitBtn.classList.remove('is-loading');
        }
      }

        function getCheckedValue(root, name) {
          var el = root.querySelector('input[name="' + name + '"]:checked');
          return el ? el.value : '';
        }

  function getCheckedValues(root, name) {
    return Array.from(root.querySelectorAll('input[name="' + name + '[]"]:checked')).map(function (el) {
      return el.value;
    });
  }

  function collectGuestPayload(card) {
    var guestId = card.getAttribute('data-guest-id') || '';
    var guestNameInput = card.querySelector('.guest-card__name-input');
    var guestNameTitle = card.querySelector('.guest-card__name');

    var guestName = '';
    if (guestNameInput) {
      guestName = (guestNameInput.value || '').trim();
    } else if (guestNameTitle) {
      guestName = (guestNameTitle.textContent || '').trim();
    }

    var eventKeys = [];
    card.querySelectorAll('.rsvp-event').forEach(function (ev) {
      var label = ev.querySelector('.rsvp-field__label');
      if (!label) return;

      var text = (label.textContent || '').toLowerCase();
      if (text.indexOf('росписи') !== -1) eventKeys.push('day1');
      else if (text.indexOf('семейном ужине') !== -1) eventKeys.push('dinner');
      else if (text.indexOf('вечеринке') !== -1) eventKeys.push('day2');
    });

    var attendance = {};
    eventKeys.forEach(function (key) {
      attendance[key] = getCheckedValue(card, 'rsvp-' + guestId + '-att-' + key);
    });

    return {
      guestId: guestId,
      name: guestName,
      isPlusOne: guestId.indexOf('plus1') === 0,
      attendance: attendance,
      party: {
        drinks: getCheckedValues(card, 'rsvp-' + guestId + '-drinks'),
        hot: getCheckedValue(card, 'rsvp-' + guestId + '-hot'),
        allergy: getCheckedValue(card, 'rsvp-' + guestId + '-allergy'),
        allergens: getCheckedValues(card, 'rsvp-' + guestId + '-allergens'),
        allergensCustom: (card.querySelector('input[name="rsvp-' + guestId + '-allergens_custom"]') || {}).value || '',
        intolerances: getCheckedValues(card, 'rsvp-' + guestId + '-intolerances'),
        intolerancesCustom: (card.querySelector('input[name="rsvp-' + guestId + '-intolerances_custom"]') || {}).value || ''
      }
    };
  }

  function collectFormPayload() {
    var cards = Array.from(document.querySelectorAll('.guest-card'));

    return {
      action: 'submit_rsvp',
      token: (window.WEDDING_API && window.WEDDING_API.token) ? window.WEDDING_API.token : '',
      guests: cards.map(collectGuestPayload)
    };
  }

  
  async function submitPayloadToApi(payload) {
    var apiBase = window.WEDDING_API && window.WEDDING_API.baseUrl;
    if (!apiBase) {
      throw new Error('API base URL not found');
    }

    var res = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    return res.json();
  }


        form.addEventListener('submit', async function (e) {
  e.preventDefault();

  if (isSubmitting) return;

    var cards = Array.from(document.querySelectorAll('.guest-card'));
    var firstInvalid = null;

    cards.forEach(function (card) {
      var ok = validateCard(card);
      if (!ok && !firstInvalid) firstInvalid = card;
    });

    if (firstInvalid) {
      window._haptics?.trigger('error');
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      setSubmittingState(true);

      var payload = collectFormPayload();
      var result = await submitPayloadToApi(payload);

      if (!result || !result.ok) {
        throw new Error((result && result.error) || 'Submit failed');
      }

      window._haptics?.trigger('success');

      var section = document.getElementById('rsvp');
      if (section) {
        section.classList.add('rsvp--done');
        var prevSep = section.previousElementSibling;
        if (prevSep && prevSep.classList.contains('schedule__sep')) {
          prevSep.style.display = 'none';
        }
      }

      var confirm = document.getElementById('rsvp-confirm');
      if (confirm) {
        confirm.hidden = false;
        setTimeout(function () {
          confirm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }


    } catch (err) {
      console.error('[WEDDING API] submit error:', err);
      window._haptics?.trigger('error');
      alert('Не удалось отправить анкету. Попробуйте ещё раз.');
      setSubmittingState(false);
    }
  });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
};
